import type { APIRoute } from 'astro';
import { apiRawFetch, UPLOAD_TIMEOUT_MS } from '../../../../lib/api';

export const prerender = false;

function noticeUrl(path: string, key: 'success' | 'error', value: string): string {
	const url = new URL(path, 'http://localhost');
	url.searchParams.set(key, value);
	return `${url.pathname}${url.search}`;
}

export const POST: APIRoute = async ({ request, cookies, locals, redirect, cache }) => {
	// AI-source-file uploads (ArticleForm.astro / PostForm.astro) POST here via fetch with this
	// header set — same convention articles/save.ts already uses — and need the new file's id
	// back as JSON instead of a redirect, since the article/post doesn't exist yet to redirect
	// a full page load back to.
	const isAjax = request.headers.get('X-Requested-With') === 'fetch';
	const token = cookies.get('token')?.value;
	if (!token) {
		if (isAjax) return new Response(JSON.stringify({ success: false, message: 'غير مصرح' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
		return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/files')}`);
	}

	const incoming = await request.formData();
	const file = incoming.get('file');
	if (!(file instanceof File) || file.size === 0) {
		if (isAjax) return new Response(JSON.stringify({ success: false, message: 'يرجى اختيار ملف للرفع' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
		return redirect(noticeUrl('/dashboard/files', 'error', 'يرجى اختيار ملف للرفع'));
	}

	const forward = new FormData();
	forward.set('file', file);
	for (const key of ['file_name', 'file_category', 'article_id', 'post_id']) {
		const value = String(incoming.get(key) || '').trim();
		if (value) forward.set(key, value);
	}

	if (forward.get('article_id') && forward.get('post_id')) {
		const message = 'لا يمكن ربط الملف بمقال ومنشور في الوقت نفسه';
		if (isAjax) return new Response(JSON.stringify({ success: false, message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
		return redirect(noticeUrl('/dashboard/files', 'error', message));
	}

	const response = await apiRawFetch('/dashboard/files', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		body: forward,
		timeoutMs: UPLOAD_TIMEOUT_MS,
	});
	const result: any = await response.json().catch(() => null);
	if (!response.ok || !result?.success) {
		const message = result?.message || 'تعذّر رفع الملف';
		if (isAjax) return new Response(JSON.stringify({ success: false, message }), { status: response.status || 502, headers: { 'Content-Type': 'application/json' } });
		return redirect(noticeUrl('/dashboard/files', 'error', message));
	}

	await cache.invalidate({ tags: ['files', 'articles', 'posts', 'classes', 'subjects'] });
	if (isAjax) return new Response(JSON.stringify({ success: true, id: result.data?.id, file_name: result.data?.file_name }), { headers: { 'Content-Type': 'application/json' } });
	return redirect(noticeUrl('/dashboard/files', 'success', 'تم رفع الملف بنجاح'));
};
