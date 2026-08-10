import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { safeRedirectPath } from '../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/security')}`);

	const form = await request.formData();
	const ip = String(form.get('ip') || '');
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/security?tab=trusted');
	const separator = redirectTo.includes('?') ? '&' : '?';

	const res = await apiRawFetch(`/dashboard/security/trusted-ips/${encodeURIComponent(ip)}`, {
		method: 'DELETE',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'فشل الإلغاء')}`);
	}
	return redirect(`${redirectTo}${separator}success=1`);
};
