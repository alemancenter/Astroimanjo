import type { APIRoute } from 'astro';
import { apiRawFetch, extractSetCookieValue } from '../../../lib/api';
import { setSessionCookies } from '../../../lib/auth';
import { safeRedirectPath } from '../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
	let payload: { provider?: string; token?: string; redirect_to?: string };
	try {
		payload = await request.json();
	} catch {
		return Response.json({ success: false, message: 'بيانات الطلب غير صحيحة.' }, { status: 400 });
	}

	const provider = payload.provider === 'google' || payload.provider === 'facebook' ? payload.provider : null;
	const token = String(payload.token || '').trim();
	const redirectTo = safeRedirectPath(String(payload.redirect_to || ''), '/');
	if (!provider || !token) {
		return Response.json({ success: false, message: 'لم يتم استلام بيانات تسجيل الدخول.' }, { status: 400 });
	}

	try {
		const response = await apiRawFetch(`/auth/${provider}/token`, {
			method: 'POST',
			countryId: locals.countryId,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token }),
		});
		const json: any = await response.json().catch(() => null);
		if (!response.ok || !json?.success) {
			return Response.json({
				success: false,
				message: json?.message || `تعذر تسجيل الدخول عبر ${provider === 'google' ? 'Google' : 'Facebook'}.`,
			}, { status: response.status >= 400 ? response.status : 401 });
		}

		const accessToken = extractSetCookieValue(response, 'token') ?? json.token ?? null;
		const refreshToken = extractSetCookieValue(response, 'refresh_token') ?? json.refresh_token ?? null;
		if (!accessToken) {
			return Response.json({ success: false, message: 'تعذر إنشاء جلسة المستخدم.' }, { status: 502 });
		}
		setSessionCookies(cookies, accessToken, refreshToken);
		return Response.json({ success: true, redirect: redirectTo });
	} catch {
		return Response.json({ success: false, message: 'تعذر الاتصال بخدمة تسجيل الدخول حاليًا.' }, { status: 502 });
	}
};
