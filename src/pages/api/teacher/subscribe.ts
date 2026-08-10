import type { APIRoute } from 'astro';
import { apiFetch, apiRawFetch } from '../../../lib/api';

export const prerender = false;

const FORWARDED_FIELDS = ['subjects', 'school', 'city', 'phone', 'payment_method', 'payer_name', 'payment_reference'];

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) {
		return redirect(`/login?redirect_to=${encodeURIComponent('/account/teacher/subscribe')}`);
	}

	const settingsResult = await apiFetch<Record<string, string>>('/front/settings', { countryId: locals.countryId });
	if (settingsResult.data?.enable_teacher_subscriptions === '0') {
		return redirect('/teachers');
	}

	const incoming = await request.formData();
	const forward = new FormData();
	for (const key of FORWARDED_FIELDS) {
		const value = incoming.get(key);
		if (value !== null) forward.set(key, value as string);
	}
	const proof = incoming.get('payment_proof');
	if (proof instanceof File && proof.size > 0) {
		forward.set('payment_proof', proof);
	}

	if (!forward.get('subjects') || !forward.get('payment_method')) {
		return redirect(`/account/teacher/subscribe?error=${encodeURIComponent('يرجى تحديد المواد وطريقة الدفع')}`);
	}

	const res = await apiRawFetch('/teacher-subscription/orders/with-proof', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		body: forward,
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`/account/teacher/subscribe?error=${encodeURIComponent(json?.message || 'تعذّر إرسال طلب الاشتراك')}`);
	}
	return redirect('/account/teacher?order_sent=1');
};
