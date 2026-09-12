import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect }) => {
	const { id, action } = params;
	const token = cookies.get('token')?.value;
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/messages');
	const separator = redirectTo.includes('?') ? '&' : '?';
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/messages')}`);

	let operation: { path: string; method: 'POST' | 'DELETE' };
	if (action === 'read') operation = { path: `/dashboard/messages/${id}/read`, method: 'POST' };
	else if (action === 'important') operation = { path: `/dashboard/messages/${id}/important`, method: 'POST' };
	else if (action === 'delete') operation = { path: `/dashboard/messages/${id}`, method: 'DELETE' };
	else return redirect(redirectTo);

	// @api-contract POST /dashboard/messages/:id/read
	// @api-contract POST /dashboard/messages/:id/important
	// @api-contract DELETE /dashboard/messages/:id
	const res = await apiRawFetch(operation.path, { method: operation.method, countryId: locals.countryId, cookieHeader: `token=${token}` });
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'فشل تنفيذ العملية')}`);
	}
	return redirect(`${redirectTo}${separator}success=1`);
};
