import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../../lib/api';
import { safeRedirectPath } from '../../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/sitemap')}`);

	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/sitemap');
	const separator = redirectTo.includes('?') ? '&' : '?';
	const res = await apiRawFetch(`/dashboard/sitemap/delete/${params.type}/${params.database}`, {
		method: 'DELETE',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'فشل حذف الملف')}`);
	}
	return redirect(`${redirectTo}${separator}success=deleted`);
};
