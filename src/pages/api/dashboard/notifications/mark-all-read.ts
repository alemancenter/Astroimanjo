import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { safeRedirectPath } from '../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/notifications')}`);

	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/notifications');
	const separator = redirectTo.includes('?') ? '&' : '?';

	await apiRawFetch('/dashboard/notifications/read-all', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
	});
	return redirect(`${redirectTo}${separator}success=1`);
};
