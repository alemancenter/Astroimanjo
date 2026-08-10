import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../lib/api';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const form = await request.formData();
	const payload = {
		name: String(form.get('name') || '').trim(),
		email: String(form.get('email') || '').trim(),
		phone: String(form.get('phone') || '').trim(),
		subject: String(form.get('subject') || '').trim(),
		message: String(form.get('message') || '').trim(),
		page_url: String(form.get('page_url') || '/contact'),
		// Google reCAPTCHA v2 widget submits its token under this exact field
		// name; the backend only enforces it when a site key is configured.
		'g-recaptcha-response': String(form.get('g-recaptcha-response') || ''),
	};

	if (!payload.name || !payload.email || !payload.subject || !payload.message) {
		return redirect(`/contact?error=${encodeURIComponent('يرجى تعبئة جميع الحقول المطلوبة')}`);
	}

	const res = await apiRawFetch('/front/contact', {
		method: 'POST',
		countryId: locals.countryId,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`/contact?error=${encodeURIComponent(json?.message || 'تعذّر إرسال الرسالة، حاول مرة أخرى.')}`);
	}

	return redirect('/contact?sent=1');
};
