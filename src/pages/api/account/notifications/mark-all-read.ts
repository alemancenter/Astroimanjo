import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { safeRedirectPath } from '../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/account/notifications')}`);
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/account/notifications');
	const url = new URL(redirectTo, 'http://local');
	try {
		const response = await apiRawFetch('/dashboard/notifications/read-all', { method: 'POST', countryId: locals.countryId, cookieHeader: `token=${token}` });
		url.searchParams.set(response.ok ? 'success' : 'error', response.ok ? 'تم تعليم جميع الإشعارات كمقروءة.' : 'تعذّر تحديث الإشعارات.');
	} catch {
		url.searchParams.set('error', 'تعذّر الاتصال بخدمة الإشعارات حاليًا.');
	}
	return redirect(`${url.pathname}${url.search}`);
};
