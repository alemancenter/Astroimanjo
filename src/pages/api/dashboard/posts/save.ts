import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { generateMetaDescription, generateKeywords } from '../../../../lib/seo-autofill';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect, cache }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/posts')}`);

	const incoming = await request.formData();
	const id = String(incoming.get('id') || '');
	const isEdit = !!id;
	const title = String(incoming.get('title') || '').trim();
	const content = String(incoming.get('content') || '').trim();
	const metaDescription = String(incoming.get('meta_description') || '').trim() || generateMetaDescription(title, content);
	const keywords = String(incoming.get('keywords') || '').trim() || generateKeywords(title, content);
	const alt = String(incoming.get('alt') || '').trim() || title;
	const isActiveValue = String(incoming.get('is_active') ?? 'false').toLowerCase();

	const forward = new FormData();
	forward.set('category_id', String(incoming.get('category_id') || ''));
	forward.set('title', title);
	forward.set('content', content);
	forward.set('alt', alt);
	forward.set('keywords', keywords);
	forward.set('meta_description', metaDescription);
	forward.set('is_active', ['true', '1', 'on'].includes(isActiveValue) ? 'true' : 'false');
	forward.set('is_featured', incoming.get('is_featured') ? 'true' : 'false');

	const image = incoming.get('image');
	if (image instanceof File && image.size > 0) {
		forward.set(isEdit ? 'new_image' : 'image', image);
	}
	for (const attachment of incoming.getAll('attachments')) {
		if (attachment instanceof File && attachment.size > 0) forward.append('attachments', attachment);
	}

	if (!forward.get('title') || !forward.get('content') || !forward.get('category_id')) {
		const back = isEdit ? `/dashboard/posts/${id}/edit` : '/dashboard/posts/new';
		return redirect(`${back}?error=${encodeURIComponent('يرجى تعبئة العنوان والمحتوى والقسم')}`);
	}

	const res = await apiRawFetch(isEdit ? `/dashboard/posts/${id}` : '/dashboard/posts', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		body: forward,
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		const back = isEdit ? `/dashboard/posts/${id}/edit` : '/dashboard/posts/new';
		return redirect(`${back}?error=${encodeURIComponent(json?.message || 'تعذّر حفظ المنشور')}`);
	}
	await cache.invalidate({ tags: ['posts'] });
	return redirect('/dashboard/posts?success=1');
};
