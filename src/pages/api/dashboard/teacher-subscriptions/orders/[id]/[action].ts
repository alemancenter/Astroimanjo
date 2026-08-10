import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../../lib/api';
import { safeRedirectPath } from '../../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect }) => {
	const { id, action } = params;
	const token = cookies.get('token')?.value;
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/teacher-subscriptions');
	const adminNote = String(form.get('admin_note') || '');

	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/teacher-subscriptions')}`);

	let path = '';
	if (action === 'approve') path = `/dashboard/teacher-subscriptions/orders/${id}/approve`;
	else if (action === 'reject') path = `/dashboard/teacher-subscriptions/orders/${id}/reject`;
	else return redirect(redirectTo);

	const res = await apiRawFetch(path, {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ admin_note: adminNote }),
	});
	const json: any = await res.json().catch(() => null);
	const separator = redirectTo.includes('?') ? '&' : '?';

	if (!res.ok || !json?.success) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'فشل تنفيذ العملية')}`);
	}
	return redirect(`${redirectTo}${separator}success=1`);
};
