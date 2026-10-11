import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/contact-messages')}`);
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/contact-messages');
	const separator = redirectTo.includes('?') ? '&' : '?';
	const ids = form.getAll('ids').map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);

	if (ids.length === 0) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent('يرجى تحديد رسالة واحدة على الأقل')}`);
	}

	const res = await apiRawFetch('/dashboard/contact-messages/bulk/delete', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ids }),
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'فشل حذف الرسائل المحددة')}`);
	}
	return redirect(`${redirectTo}${separator}success=1`);
};
