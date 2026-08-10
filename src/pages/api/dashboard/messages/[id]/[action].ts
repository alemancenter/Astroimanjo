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

	let path = '';
	let method: 'POST' | 'DELETE' = 'POST';
	if (action === 'read') path = `/dashboard/messages/${id}/read`;
	else if (action === 'important') path = `/dashboard/messages/${id}/important`;
	else if (action === 'delete') {
		path = `/dashboard/messages/${id}`;
		method = 'DELETE';
	} else return redirect(redirectTo);

	const res = await apiRawFetch(path, { method, countryId: locals.countryId, cookieHeader: `token=${token}` });
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'فشل تنفيذ العملية')}`);
	}
	return redirect(`${redirectTo}${separator}success=1`);
};
