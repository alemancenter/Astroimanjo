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
	const payload = {
		type: 'App\\Notifications\\AdminBroadcast',
		title: String(form.get('title') || '').trim(),
		message: String(form.get('message') || '').trim(),
		action_url: String(form.get('action_url') || ''),
		role: String(form.get('role') || ''),
	};

	if (!payload.title || !payload.message) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent('يرجى إدخال العنوان والرسالة')}`);
	}

	const res = await apiRawFetch('/dashboard/notifications/broadcast', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'تعذّر إرسال الإشعار')}`);
	}
	return redirect(`${redirectTo}${separator}success=1`);
};
