import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

// Uploads a file and attaches it directly to this article in one request (backend:
// POST /dashboard/files with article_id set — see file_service.go CreateRecord).
export const POST: APIRoute = async ({ params, request, cookies, locals, redirect, cache }) => {
	const token = cookies.get('token')?.value;
	const redirectTo = safeRedirectPath(new URL(request.url).searchParams.get('redirect_to') || '', `/dashboard/articles/${params.id}/edit`);
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent(redirectTo)}`);

	const incoming = await request.formData();
	const file = incoming.get('file');
	if (!(file instanceof File) || file.size === 0) {
		return redirect(`${redirectTo}?error=${encodeURIComponent('يرجى اختيار ملف للرفع')}`);
	}

	const forward = new FormData();
	forward.set('file', file);
	forward.set('article_id', String(params.id));
	const category = incoming.get('file_category');
	if (category) forward.set('file_category', category as string);

	const res = await apiRawFetch('/dashboard/files', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		body: forward,
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`${redirectTo}?error=${encodeURIComponent(json?.message || 'تعذّر رفع الملف')}`);
	}
	await cache.invalidate({ tags: ['articles', 'classes', 'subjects'] });
	return redirect(`${redirectTo}?success=1`);
};
