import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../lib/api';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const form = await request.formData();
	const email = String(form.get('email') || '').trim().toLowerCase();
	if (!email || !email.includes('@')) {
		return redirect(`/forgot-password?error=${encodeURIComponent('يرجى إدخال بريد إلكتروني صحيح.')}`);
	}

	try {
		const response = await apiRawFetch('/auth/password/forgot', {
			method: 'POST',
			countryId: locals.countryId,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email }),
		});
		if (!response.ok) {
			return redirect(`/forgot-password?error=${encodeURIComponent('تعذر إرسال رابط الاستعادة حاليًا، يرجى المحاولة لاحقًا.')}`);
		}
	} catch {
		return redirect(`/forgot-password?error=${encodeURIComponent('تعذر الاتصال بالخادم حاليًا، يرجى المحاولة لاحقًا.')}`);
	}

	return redirect('/forgot-password?sent=1');
};
