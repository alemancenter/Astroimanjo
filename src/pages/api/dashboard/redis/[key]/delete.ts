import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/redis')}`);
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/redis?tab=keys');

	const res = await apiRawFetch(`/dashboard/redis/${encodeURIComponent(params.key ?? '')}`, {
		method: 'DELETE',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) {
		const url = new URL(redirectTo, 'http://localhost');
		url.searchParams.set('error', json?.message || 'تعذّر حذف مفتاح Redis.');
		return redirect(`${url.pathname}${url.search}`);
	}
	const url = new URL(redirectTo, 'http://localhost');
	url.searchParams.set('success', 'تم حذف المفتاح بنجاح.');
	return redirect(`${url.pathname}${url.search}`);
};
