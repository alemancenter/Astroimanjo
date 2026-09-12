import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/account/notifications')}`);
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/account/notifications');
	const url = new URL(redirectTo, 'http://local');
	const action = params.action;
	let operation: { path: string; method: 'POST' | 'DELETE' };
	if (action === 'read' || action === 'open') operation = { path: `/dashboard/notifications/${params.id}/read`, method: 'POST' };
	else if (action === 'delete') operation = { path: `/dashboard/notifications/${params.id}`, method: 'DELETE' };
	else return redirect(redirectTo);
	try {
		// @api-contract POST /dashboard/notifications/:id/read
		// @api-contract DELETE /dashboard/notifications/:id
		const response = await apiRawFetch(operation.path, { method: operation.method, countryId: locals.countryId, cookieHeader: `token=${token}` });
		const json: any = await response.json().catch(() => null);
		if (action === 'open' && response.ok && json?.success !== false) return redirect(redirectTo);
		if (action === 'open') {
			const failureUrl = new URL('/account/notifications', 'http://local');
			failureUrl.searchParams.set('error', json?.message || 'تعذّر فتح الإشعار أو تعليمه كمقروء.');
			return redirect(`${failureUrl.pathname}${failureUrl.search}`);
		}
		url.searchParams.set(response.ok && json?.success !== false ? 'success' : 'error', response.ok && json?.success !== false ? (action === 'delete' ? 'تم حذف الإشعار.' : 'تم تعليم الإشعار كمقروء.') : (json?.message || 'تعذّر تنفيذ العملية.'));
	} catch {
		if (action === 'open') return redirect('/account/notifications?error=' + encodeURIComponent('تعذّر الاتصال بخدمة الإشعارات حاليًا.'));
		url.searchParams.set('error', 'تعذّر الاتصال بخدمة الإشعارات حاليًا.');
	}
	return redirect(`${url.pathname}${url.search}`);
};
