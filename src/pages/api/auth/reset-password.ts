import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../lib/api';

export const prerender = false;

function resetUrl(token: string, email: string, error?: string): string {
	const params = new URLSearchParams({ token, email });
	if (error) params.set('error', error);
	return `/reset-password?${params.toString()}`;
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const form = await request.formData();
	const token = String(form.get('token') || '').trim();
	const email = String(form.get('email') || '').trim().toLowerCase();
	const password = String(form.get('password') || '');
	const confirmation = String(form.get('password_confirmation') || '');

	if (!token || !email || !email.includes('@')) return redirect(resetUrl(token, email, 'رابط الاستعادة غير صالح أو غير مكتمل.'));
	if (password.length < 8) return redirect(resetUrl(token, email, 'يجب ألا تقل كلمة المرور عن 8 أحرف.'));
	if (password !== confirmation) return redirect(resetUrl(token, email, 'كلمتا المرور غير متطابقتين.'));

	try {
		const response = await apiRawFetch('/auth/password/reset', {
			method: 'POST',
			countryId: locals.countryId,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token, email, password, password_confirmation: confirmation }),
		});
		if (!response.ok) return redirect(resetUrl(token, email, 'انتهت صلاحية الرابط أو أنه غير صالح. اطلب رابطًا جديدًا.'));
	} catch {
		return redirect(resetUrl(token, email, 'تعذر الاتصال بالخادم حاليًا، يرجى المحاولة لاحقًا.'));
	}

	return redirect('/reset-password?done=1');
};
