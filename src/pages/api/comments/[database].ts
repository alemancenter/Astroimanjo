import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../lib/api';
import { safeRedirectPath } from '../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect }) => {
	const database = params.database;
	const token = cookies.get('token')?.value;
	const form = await request.formData();
	const body = String(form.get('body') || '').trim();
	const commentableId = String(form.get('commentable_id') || '');
	const commentableType = String(form.get('commentable_type') || '');
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/');

	if (!token) {
		return redirect(`/login?redirect_to=${encodeURIComponent(redirectTo)}`);
	}
	if (!body || !commentableId || !commentableType) {
		return redirect(`${redirectTo}?error=${encodeURIComponent('يرجى كتابة نص التعليق')}#comments`);
	}
	if (!['App\\Models\\Article', 'App\\Models\\Post'].includes(commentableType)) {
		return redirect(`${redirectTo}?error=${encodeURIComponent('نوع المحتوى غير مدعوم')}#comments`);
	}
	if (body.length < 2 || body.length > 2000) {
		return redirect(`${redirectTo}?error=${encodeURIComponent('يجب أن يكون التعليق بين حرفين و2000 حرف')}#comments`);
	}

	const res = await apiRawFetch(`/comments/${database}`, {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			body,
			commentable_id: Number(commentableId),
			commentable_type: commentableType,
		}),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`${redirectTo}?error=${encodeURIComponent(json?.message || 'تعذّر إرسال التعليق')}#comments`);
	}

	return redirect(`${redirectTo}?comment_sent=1#comments`);
};
