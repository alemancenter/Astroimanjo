import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../../lib/api';
import { safeRedirectPath } from '../../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect }) => {
	const { id, action } = params;
	const token = cookies.get('token')?.value;
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/teacher-subscriptions/subscriptions');
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/teacher-subscriptions/subscriptions')}`);

	let path = '';
	let body: Record<string, unknown> = {};
	if (action === 'cancel') {
		path = `/dashboard/teacher-subscriptions/subscriptions/${id}/cancel`;
		body = { admin_note: String(form.get('admin_note') || '') };
	} else if (action === 'renew') {
		path = `/dashboard/teacher-subscriptions/subscriptions/${id}/renew`;
		body = {
			ends_at: String(form.get('ends_at') || ''),
			extra_days: form.get('extra_days') ? Number(form.get('extra_days')) : 0,
			admin_note: String(form.get('admin_note') || ''),
		};
	} else if (action === 'reactivate') {
		path = `/dashboard/teacher-subscriptions/subscriptions/${id}/reactivate`;
		body = { admin_note: String(form.get('admin_note') || '') };
	} else if (action === 'dates') {
		path = `/dashboard/teacher-subscriptions/subscriptions/${id}/dates`;
		body = {
			starts_at: String(form.get('starts_at') || ''),
			ends_at: String(form.get('ends_at') || ''),
			admin_note: String(form.get('admin_note') || ''),
		};
	} else return redirect(redirectTo);

	const res = await apiRawFetch(path, {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`${redirectTo}?error=${encodeURIComponent(json?.message || 'فشل تنفيذ العملية')}`);
	}
	return redirect(`${redirectTo}?success=1`);
};
