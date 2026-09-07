import type { APIRoute } from 'astro';
import { apiRawFetch, extractSetCookieValue } from '../../../lib/api';
import { setSessionCookies } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const form = await request.formData();
	const name = String(form.get('name') || '').replace(/\s+/g, ' ').trim();
	const email = String(form.get('email') || '').trim();
	const password = String(form.get('password') || '');
	const passwordConfirmation = String(form.get('password_confirmation') || '');
	const honeypot = String(form.get('website') || '').trim();

	// Honeypot filled → automated client. Bounce without hitting the backend.
	if (honeypot) {
		return redirect(`/register?error=${encodeURIComponent('تعذّر إنشاء الحساب')}`);
	}

	if (!name || !email || !password) {
		return redirect(`/register?error=${encodeURIComponent('يرجى تعبئة جميع الحقول المطلوبة')}`);
	}

	// Fast client-facing reject for the spam pattern (links / over-long name); the
	// backend enforces the full rule set.
	if (name.length > 60 || /(https?:\/\/|www\.|\bt\.me\b|tinyurl|bit\.ly|@)/i.test(name)) {
		return redirect(`/register?error=${encodeURIComponent('الاسم غير صالح — اكتب اسمك فقط بدون روابط')}`);
	}

	const res = await apiRawFetch('/auth/register', {
		method: 'POST',
		countryId: locals.countryId,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name,
			email,
			password,
			password_confirmation: passwordConfirmation,
			website: honeypot,
		}),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		const firstFieldError =
			json?.errors && typeof json.errors === 'object' ? (Object.values(json.errors)[0] as string) : null;
		const message = firstFieldError || json?.message || 'تعذّر إنشاء الحساب';
		return redirect(`/register?error=${encodeURIComponent(message)}`);
	}

	const token = extractSetCookieValue(res, 'token') ?? json.token ?? null;
	const refreshToken = extractSetCookieValue(res, 'refresh_token') ?? json.refresh_token ?? null;
	setSessionCookies(cookies, token, refreshToken);

	return redirect('/account?welcome=1');
};
