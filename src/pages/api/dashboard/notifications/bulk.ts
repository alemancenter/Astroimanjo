import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { safeRedirectPath } from '../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/notifications')}`);
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/notifications');
	const separator = redirectTo.includes('?') ? '&' : '?';
	const action = String(form.get('action') || '');
	const ids = form.getAll('ids').map((value) => String(value).trim()).filter(Boolean);
	if (!['delete', 'read'].includes(action) || ids.length === 0) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent('حدد إشعارًا واحدًا على الأقل')}`);
	}
	const res = await apiRawFetch('/dashboard/notifications/bulk', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action, ids }),
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'فشل تنفيذ الإجراء الجماعي')}`);
	}
	return redirect(`${redirectTo}${separator}success=1`);
};
