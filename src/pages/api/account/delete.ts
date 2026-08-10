import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../lib/api';
import { clearSessionCookies } from '../../../lib/auth';

export const prerender = false;

// Backend requires a verified email for this action (route_auth.go:
// RequireVerifiedEmail() on POST /auth/account/delete) — an unverified visitor just gets
// the backend's own error message back, no special-casing needed here.
export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect('/login?redirect_to=%2Faccount');

	const form = await request.formData();
	const password = String(form.get('password') || '');
	if (!password) {
		return redirect(`/account?error=${encodeURIComponent('يرجى إدخال كلمة المرور لتأكيد الحذف')}`);
	}

	const res = await apiRawFetch('/auth/account/delete', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ password }),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`/account?error=${encodeURIComponent(json?.message || 'تعذّر حذف الحساب')}`);
	}

	clearSessionCookies(cookies);
	return redirect('/?account_deleted=1');
};
