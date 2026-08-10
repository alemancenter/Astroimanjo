import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../../lib/api';
import { safeRedirectPath } from '../../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/security')}`);
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/security?tab=events');
	const separator = redirectTo.includes('?') ? '&' : '?';

	const res = await apiRawFetch(`/dashboard/security/logs/${params.id}/resolve`, {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || !json?.success) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'فشل تحديد السجل كمُعالج')}`);
	}
	return redirect(`${redirectTo}${separator}success=1`);
};
