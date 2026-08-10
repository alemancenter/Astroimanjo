import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { safeRedirectPath } from '../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/security')}`);

	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/security?tab=blocked');
	const separator = redirectTo.includes('?') ? '&' : '?';
	const payload = {
		ip_address: String(form.get('ip_address') || '').trim(),
		reason: String(form.get('reason') || '').trim(),
		days: form.get('days') ? Number(form.get('days')) : 0,
	};

	if (!payload.ip_address) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent('يرجى إدخال عنوان IP')}`);
	}

	const res = await apiRawFetch('/dashboard/security/ip/block', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || !json?.success) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'فشل حظر العنوان')}`);
	}
	return redirect(`${redirectTo}${separator}success=1`);
};
