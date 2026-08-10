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
	const action = String(form.get('action') || '');
	const ids = form.getAll('ids').map(String).filter(Boolean);
	if (!['read', 'delete'].includes(action) || !ids.length) {
		url.searchParams.set('error', 'حدد إشعارًا واحدًا على الأقل.');
		return redirect(`${url.pathname}${url.search}`);
	}
	try {
		const response = await apiRawFetch('/dashboard/notifications/bulk', {
			method: 'POST', countryId: locals.countryId, cookieHeader: `token=${token}`,
			headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ids }),
		});
		const json: any = await response.json().catch(() => null);
		url.searchParams.set(response.ok && json?.success !== false ? 'success' : 'error', response.ok && json?.success !== false ? (action === 'delete' ? 'تم حذف الإشعارات المحددة.' : 'تم تعليم الإشعارات المحددة كمقروءة.') : (json?.message || 'تعذّر تنفيذ الإجراء.'));
	} catch {
		url.searchParams.set('error', 'تعذّر الاتصال بخدمة الإشعارات حاليًا.');
	}
	return redirect(`${url.pathname}${url.search}`);
};
