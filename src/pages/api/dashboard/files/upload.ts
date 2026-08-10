import type { APIRoute } from 'astro';
import { apiRawFetch, UPLOAD_TIMEOUT_MS } from '../../../../lib/api';

export const prerender = false;

function noticeUrl(path: string, key: 'success' | 'error', value: string): string {
	const url = new URL(path, 'http://localhost');
	url.searchParams.set(key, value);
	return `${url.pathname}${url.search}`;
}

export const POST: APIRoute = async ({ request, cookies, locals, redirect, cache }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/files')}`);

	const incoming = await request.formData();
	const file = incoming.get('file');
	if (!(file instanceof File) || file.size === 0) {
		return redirect(noticeUrl('/dashboard/files', 'error', 'يرجى اختيار ملف للرفع'));
	}

	const forward = new FormData();
	forward.set('file', file);
	for (const key of ['file_name', 'file_category', 'article_id', 'post_id']) {
		const value = String(incoming.get(key) || '').trim();
		if (value) forward.set(key, value);
	}

	if (forward.get('article_id') && forward.get('post_id')) {
		return redirect(noticeUrl('/dashboard/files', 'error', 'لا يمكن ربط الملف بمقال ومنشور في الوقت نفسه'));
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
		return redirect(noticeUrl('/dashboard/files', 'error', result?.message || 'تعذّر رفع الملف'));
	}

	await cache.invalidate({ tags: ['files', 'articles', 'posts', 'classes', 'subjects'] });
	return redirect(noticeUrl('/dashboard/files', 'success', 'تم رفع الملف بنجاح'));
};
