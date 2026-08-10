import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../lib/api';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) {
		return redirect('/login');
	}

	const res = await apiRawFetch('/auth/email/resend', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`/account?error=${encodeURIComponent(json?.message || 'تعذّر إرسال رسالة التفعيل')}`);
	}
	return redirect('/account?verification_sent=1');
};
