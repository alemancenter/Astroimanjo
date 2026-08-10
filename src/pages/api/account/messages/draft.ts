import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

const notice = (kind: 'success' | 'error', message: string) => {
	const url = new URL('/account/messages', 'http://local');
	url.searchParams.set('tab', kind === 'success' ? 'drafts' : 'inbox');
	url.searchParams.set(kind, message);
	return `${url.pathname}${url.search}`;
};

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/account/messages')}`);

	const form = await request.formData();
	const payload = {
		recipient_id: Number(form.get('recipient_id') || 0),
		subject: String(form.get('subject') || '').trim(),
		body: String(form.get('body') || '').trim(),
	};
	if (!payload.recipient_id) return redirect(notice('error', 'اختر مستلمًا قبل حفظ المسودة.'));

	try {
		const response = await apiRawFetch('/dashboard/messages/draft', {
			method: 'POST',
			countryId: locals.countryId,
			cookieHeader: `token=${token}`,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		const json: any = await response.json().catch(() => null);
		if (!response.ok || json?.success === false) return redirect(notice('error', json?.message || 'تعذّر حفظ المسودة.'));
		return redirect(notice('success', 'تم حفظ الرسالة ضمن المسودات.'));
	} catch {
		return redirect(notice('error', 'تعذّر الاتصال بخدمة الرسائل حاليًا.'));
	}
};
