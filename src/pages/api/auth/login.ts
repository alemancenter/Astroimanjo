import type { APIRoute } from 'astro';
import { apiRawFetch, extractSetCookieValue } from '../../../lib/api';
import { setSessionCookies } from '../../../lib/auth';
import { safeRedirectPath } from '../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const form = await request.formData();
	const email = String(form.get('email') || '').trim();
	const password = String(form.get('password') || '');
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/');
	const loginErrorUrl = (message: string) => `/login?error=${encodeURIComponent(message)}&redirect_to=${encodeURIComponent(redirectTo)}`;

	if (!email || !password) return redirect(loginErrorUrl('يرجى إدخال البريد الإلكتروني وكلمة المرور'));

	try {
		const response = await apiRawFetch('/auth/login', {
			method: 'POST',
			countryId: locals.countryId,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password }),
		});
		const json: any = await response.json().catch(() => null);

		if (!response.ok || !json?.success) return redirect(loginErrorUrl(json?.message || 'تعذّر تسجيل الدخول'));

		const token = extractSetCookieValue(response, 'token') ?? json.token ?? null;
		const refreshToken = extractSetCookieValue(response, 'refresh_token') ?? json.refresh_token ?? null;
		setSessionCookies(cookies, token, refreshToken);
		return redirect(redirectTo);
	} catch {
		return redirect(loginErrorUrl('تعذر الاتصال بخدمة تسجيل الدخول حاليًا'));
	}
};
