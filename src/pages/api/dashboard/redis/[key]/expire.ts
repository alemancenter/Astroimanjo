import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/redis?tab=keys')}`);
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/redis?tab=keys');
	const ttl = Math.max(1, Number.parseInt(String(form.get('ttl') || '604800'), 10) || 604800);
	const res = await apiRawFetch(`/dashboard/redis/${encodeURIComponent(params.key ?? '')}/expire`, {
		method: 'POST', countryId: locals.countryId, cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ttl }),
	});
	const json: any = await res.json().catch(() => null);
	const url = new URL(redirectTo, 'http://localhost');
	url.searchParams.set(res.ok && json?.success !== false ? 'success' : 'error', res.ok && json?.success !== false ? 'تم تحديث مدة صلاحية المفتاح.' : (json?.message || 'تعذّر تحديث مدة الصلاحية.'));
	return redirect(`${url.pathname}${url.search}`);
};
