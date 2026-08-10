import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../lib/api';

export const prerender = false;

// For changing an *unverified* email before the user ever confirms it
// (back/internal/routes/route_auth.go: POST /auth/email/change).
export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect('/login?redirect_to=%2Faccount');

	const form = await request.formData();
	const email = String(form.get('email') || '').trim();
	if (!email) {
		return redirect(`/account?error=${encodeURIComponent('يرجى إدخال بريد إلكتروني صحيح')}`);
	}

	const res = await apiRawFetch('/auth/email/change', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email }),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`/account?error=${encodeURIComponent(json?.message || 'تعذّر تحديث البريد الإلكتروني')}`);
	}
	return redirect('/account?email_changed=1');
};
