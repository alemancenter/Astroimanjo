import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../../lib/api';
import { safeRedirectPath } from '../../../../../../lib/safe-redirect';

export const prerender = false;

function addNotice(path: string, key: 'success' | 'error', value: string): string {
	const url = new URL(path, 'http://localhost');
	url.searchParams.set(key, value);
	return `${url.pathname}${url.search}`;
}

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect, cache }) => {
	const { database, id, action } = params;
	const token = cookies.get('token')?.value;
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/comments');

	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/comments')}`);

	let path = '';
	let method: 'POST' | 'DELETE' = 'POST';
	if (action === 'approve') path = `/dashboard/comments/${database}/${id}/approve`;
	else if (action === 'reject') path = `/dashboard/comments/${database}/${id}/reject`;
	else if (action === 'delete') {
		path = `/dashboard/comments/${database}/${id}`;
		method = 'DELETE';
	} else return redirect(redirectTo);

	const res = await apiRawFetch(path, { method, countryId: locals.countryId, cookieHeader: `token=${token}` });
	const json: any = await res.json().catch(() => null);

	if (!res.ok || json?.success === false) {
		return redirect(addNotice(redirectTo, 'error', json?.message || 'فشل تنفيذ العملية'));
	}
	await cache.invalidate({ tags: ['comments', 'articles', 'posts'] });
	const successMessage = action === 'approve' ? 'تم قبول التعليق ونشره' : action === 'reject' ? 'تم رفض التعليق وإخفاؤه' : 'تم حذف التعليق نهائيًا';
	return redirect(addNotice(redirectTo, 'success', successMessage));
};
