import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/account/messages')}`);

	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/account/messages');
	const url = new URL(redirectTo, 'http://local');
	const id = String(params.id || '');
	let path = '';
	let method: 'POST' | 'DELETE' = 'POST';
	if (params.action === 'read') path = `/dashboard/messages/${id}/read`;
	else if (params.action === 'important') path = `/dashboard/messages/${id}/important`;
	else if (params.action === 'delete') {
		path = `/dashboard/messages/${id}`;
		method = 'DELETE';
	} else return redirect(redirectTo);

	try {
		const response = await apiRawFetch(path, { method, countryId: locals.countryId, cookieHeader: `token=${token}` });
		const json: any = await response.json().catch(() => null);
		if (!response.ok || json?.success === false) url.searchParams.set('error', json?.message || 'تعذّر تنفيذ العملية.');
		else url.searchParams.set('success', params.action === 'delete' ? 'تم حذف الرسالة.' : 'تم تحديث الرسالة.');
	} catch {
		url.searchParams.set('error', 'تعذّر الاتصال بخدمة الرسائل حاليًا.');
	}
	return redirect(`${url.pathname}${url.search}`);
};
