import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect, cache }) => {
	const { id, action } = params;
	const token = cookies.get('token')?.value;
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/articles');

	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/articles')}`);

	let path = '';
	let method: 'POST' | 'DELETE' = 'POST';
	if (action === 'publish') path = `/dashboard/articles/${id}/publish`;
	else if (action === 'unpublish') path = `/dashboard/articles/${id}/unpublish`;
	else if (action === 'delete') {
		path = `/dashboard/articles/${id}`;
		method = 'DELETE';
	} else return redirect(redirectTo);

	const res = await apiRawFetch(path, { method, countryId: locals.countryId, cookieHeader: `token=${token}` });
	const json: any = await res.json().catch(() => null);

	if (!res.ok || json?.success === false) {
		return redirect(`${redirectTo}?error=${encodeURIComponent(json?.message || 'فشل تنفيذ العملية')}`);
	}
	await cache.invalidate({ tags: ['articles', 'classes', 'subjects'] });
	return redirect(`${redirectTo}?success=1`);
};
