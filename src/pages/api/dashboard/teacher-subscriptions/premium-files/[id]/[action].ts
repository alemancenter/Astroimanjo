import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../../lib/api';
import { safeRedirectPath } from '../../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect }) => {
	const { id, action } = params;
	const token = cookies.get('token')?.value;
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/teacher-subscriptions/premium-files');
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/teacher-subscriptions/premium-files')}`);

	let path = '';
	let body: string | undefined;
	if (action === 'archive') {
		path = `/dashboard/teacher-subscriptions/premium-files/${id}/archive`;
		body = JSON.stringify({ reason: String(form.get('reason') || '') });
	} else if (action === 'disable') {
		path = `/dashboard/teacher-subscriptions/premium-files/${id}/disable`;
	} else if (action === 'enable') {
		path = `/dashboard/teacher-subscriptions/premium-files/${id}?active=true`;
		body = JSON.stringify({});
	} else return redirect(redirectTo);

	const res = await apiRawFetch(path, {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body,
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || json?.success === false) {
		return redirect(`${redirectTo}?error=${encodeURIComponent(json?.message || 'فشل تنفيذ العملية')}`);
	}
	return redirect(`${redirectTo}?success=1`);
};
