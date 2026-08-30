import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { generateMetaDescription, generateKeywords } from '../../../../lib/seo-autofill';
import { seoPayloadFromForm } from '../../../../lib/iman-seo';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect, cache }) => {
	// The create form submits via fetch (not a native POST) so it can read back the new
	// article's id and upload any staged files right after — see ArticleForm.astro. The edit
	// form still posts natively; both hit this same route, so the response shape is the only
	// thing that branches on this header.
	const isAjax = request.headers.get('X-Requested-With') === 'fetch';
	const jsonResponse = (body: Record<string, unknown>, status: number) =>
		new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

	const token = cookies.get('token')?.value;
	if (!token) {
		if (isAjax) return jsonResponse({ success: false, message: 'يجب تسجيل الدخول' }, 401);
		return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/articles')}`);
	}

	const form = await request.formData();
	const id = String(form.get('id') || '');
	const isEdit = !!id;

	const title = String(form.get('title') || '').trim();
	const content = String(form.get('content') || '').trim();
	// SEO fallback: an article never ships without a description/keywords, even if the admin
	// didn't use AI generation (which already fills these) or type them by hand.
	const metaDescription = String(form.get('meta_description') || '').trim() || generateMetaDescription(title, content);
	const keywords = String(form.get('keywords') || '').trim() || generateKeywords(title, content);

	const payload = {
		title,
		content,
		grade_level: String(form.get('grade_level') || ''),
		subject_id: form.get('subject_id') ? Number(form.get('subject_id')) : null,
		semester_id: form.get('semester_id') ? Number(form.get('semester_id')) : null,
		meta_description: metaDescription,
		keywords,
		status: form.get('status') ? Number(form.get('status')) : 0,
	};

	if (!payload.title || !payload.content) {
		const message = 'يرجى تعبئة العنوان والمحتوى';
		if (isAjax) return jsonResponse({ success: false, message }, 400);
		const back = isEdit ? `/dashboard/articles/${id}/edit` : '/dashboard/articles/new';
		return redirect(`${back}?error=${encodeURIComponent(message)}`);
	}

	const res = await apiRawFetch(isEdit ? `/dashboard/articles/${id}` : '/dashboard/articles', {
		method: isEdit ? 'PUT' : 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		const message = json?.message || 'تعذّر حفظ المقال';
		if (isAjax) return jsonResponse({ success: false, message }, res.status || 400);
		const back = isEdit ? `/dashboard/articles/${id}/edit` : '/dashboard/articles/new';
		return redirect(`${back}?error=${encodeURIComponent(message)}`);
	}

	// The AI-source file (if any) was uploaded immediately, before the article existed, via
	// files/upload.ts with no article_id set — see ArticleForm.astro. Now that a real article
	// id exists, associate it so it shows up as a normal attachment too, not just AI input.
	const sourceFileId = String(form.get('ai_source_file_id') || '').trim();
	const articleId = isEdit ? id : json?.data?.id;
	if (sourceFileId && articleId) {
		await apiRawFetch(`/dashboard/files/${sourceFileId}`, {
			method: 'PUT',
			countryId: locals.countryId,
			cookieHeader: `token=${token}`,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ article_id: Number(articleId) }),
		}).catch(() => null);
	}

	let seoWarning = '';
	if (articleId) {
		const seoRes = await apiRawFetch(`/dashboard/seo/metadata/article/${articleId}`, {
			method: 'PUT',
			countryId: locals.countryId,
			cookieHeader: `token=${token}`,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(seoPayloadFromForm(form)),
		});
		if (!seoRes.ok) {
			const seoJson: any = await seoRes.json().catch(() => null);
			seoWarning = seoJson?.message || 'حُفظ المقال، لكن تعذّر حفظ إعدادات SEO';
		}
	}

	// Article/file counts roll up into the parent class and subject pages too.
	await cache.invalidate({ tags: ['articles', 'classes', 'subjects'] });

	if (isAjax) return jsonResponse({ success: true, id: json?.data?.id, seo_warning: seoWarning || undefined }, 200);

	// New articles land on their own edit page (not the list) — that's where file
	// attachments can actually be added, and there's no reason to make the admin
	// navigate there manually right after creating it.
	const newId = json?.data?.id;
	const destination = isEdit || !newId ? '/dashboard/articles?success=1' : `/dashboard/articles/${newId}/edit?success=1`;
	return redirect(seoWarning ? `${destination}&seo_warning=${encodeURIComponent(seoWarning)}` : destination);
};
