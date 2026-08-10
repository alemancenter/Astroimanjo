import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/chatbot')}`);

	const form = await request.formData();
	const id = String(form.get('id') || '');
	const isEdit = !!id;
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/chatbot?tab=knowledge');
	const separator = redirectTo.includes('?') ? '&' : '?';
	const payload = {
		title: String(form.get('title') || '').trim(),
		question: String(form.get('question') || '').trim(),
		answer: String(form.get('answer') || '').trim(),
		category: String(form.get('category') || '').trim(),
		keywords: String(form.get('keywords') || '').trim(),
		country_code: String(form.get('country_code') || '').trim(),
		priority: Math.max(1, Math.min(999, Number(form.get('priority') || 10))),
		is_active: form.get('is_active') === 'on',
	};

	if (!payload.title || !payload.question || !payload.answer) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent('يرجى تعبئة العنوان والسؤال والجواب')}`);
	}

	const res = await apiRawFetch(isEdit ? `/dashboard/chatbot/knowledge/${id}` : '/dashboard/chatbot/knowledge', {
		method: isEdit ? 'PUT' : 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || !json?.success) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'تعذّر حفظ المعرفة')}`);
	}
	return redirect(`${redirectTo}${separator}success=${isEdit ? 'updated' : 'created'}`);
};
