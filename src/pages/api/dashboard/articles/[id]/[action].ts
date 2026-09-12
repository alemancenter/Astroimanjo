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

	let operation: { path: string; method: 'POST' | 'DELETE' };
	if (action === 'publish') operation = { path: `/dashboard/articles/${id}/publish`, method: 'POST' };
	else if (action === 'unpublish') operation = { path: `/dashboard/articles/${id}/unpublish`, method: 'POST' };
	else if (action === 'delete') operation = { path: `/dashboard/articles/${id}`, method: 'DELETE' };
	else return redirect(redirectTo);

	// @api-contract POST /dashboard/articles/:id/publish
	// @api-contract POST /dashboard/articles/:id/unpublish
	// @api-contract DELETE /dashboard/articles/:id
	const res = await apiRawFetch(operation.path, { method: operation.method, countryId: locals.countryId, cookieHeader: `token=${token}` });
	const json: any = await res.json().catch(() => null);

	if (!res.ok || json?.success === false) {
		return redirect(`${redirectTo}?error=${encodeURIComponent(json?.message || 'فشل تنفيذ العملية')}`);
	}
	await cache.invalidate({ tags: ['articles', 'classes', 'subjects'] });
	return redirect(`${redirectTo}?success=1`);
};
