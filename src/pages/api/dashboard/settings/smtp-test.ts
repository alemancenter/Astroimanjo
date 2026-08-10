import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/settings')}`);

	const form = await request.formData();
	const payload = {
		host: String(form.get('mail_host') || ''),
		port: String(form.get('mail_port') || ''),
		username: String(form.get('mail_username') || ''),
		password: String(form.get('mail_password') || ''),
		encryption: String(form.get('mail_encryption') || ''),
		from_address: String(form.get('mail_from_address') || ''),
		from_name: String(form.get('mail_from_name') || ''),
	};

	const res = await apiRawFetch('/dashboard/settings/smtp/test', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`/dashboard/settings?tab=mail&error=${encodeURIComponent(json?.message || 'فشل الاتصال بخادم البريد')}`);
	}
	return redirect(`/dashboard/settings?tab=mail&success=1`);
};
