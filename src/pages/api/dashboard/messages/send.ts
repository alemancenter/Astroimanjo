import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { safeRedirectPath } from '../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/messages')}`);

	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/messages');
	const separator = redirectTo.includes('?') ? '&' : '?';
	const payload = {
		recipient_id: Number(form.get('recipient_id') || 0),
		subject: String(form.get('subject') || '').trim(),
		body: String(form.get('body') || '').trim(),
	};

	if (!payload.recipient_id || !payload.subject || !payload.body) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent('يرجى تحديد المستلم وموضوع الرسالة ونصها')}`);
	}

	const res = await apiRawFetch('/dashboard/messages/send', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'تعذّر إرسال الرسالة')}`);
	}
	return redirect('/dashboard/messages?tab=sent&success=1');
};
