import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

function addNotice(path: string, key: 'success' | 'error', value: string): string {
	const url = new URL(path, 'http://localhost');
	url.searchParams.set(key, value);
	return `${url.pathname}${url.search}`;
}

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect, cache }) => {
	const token = cookies.get('token')?.value;
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/files');
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/files')}`);

	const res = await apiRawFetch(`/dashboard/files/${params.id}`, {
		method: 'DELETE',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) {
		return redirect(addNotice(redirectTo, 'error', json?.message || 'فشل حذف الملف'));
	}
	// This endpoint deletes a file by ID without knowing whether it belonged to an article or
	// a post — invalidate every content tag it could plausibly affect rather than guess wrong.
	await cache.invalidate({ tags: ['files', 'articles', 'posts', 'classes', 'subjects'] });
	return redirect(addNotice(redirectTo, 'success', 'تم حذف الملف نهائيًا'));
};
