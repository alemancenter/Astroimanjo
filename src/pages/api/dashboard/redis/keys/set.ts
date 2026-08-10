import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/redis?tab=keys')}`);
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/redis?tab=keys');
	const key = String(form.get('key') || '').trim();
	const value = String(form.get('value') || '');
	const persist = form.get('persist') === '1';
	const ttl = Math.max(0, Number.parseInt(String(form.get('ttl') || '3600'), 10) || 0);
	if (!key || !value) {
		const invalidUrl = new URL(redirectTo, 'http://localhost');
		invalidUrl.searchParams.set('error', 'اسم المفتاح والقيمة مطلوبان.');
		return redirect(`${invalidUrl.pathname}${invalidUrl.search}`);
	}

	const res = await apiRawFetch('/dashboard/redis', {
		method: 'POST', countryId: locals.countryId, cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value, ttl, persist }),
	});
	const json: any = await res.json().catch(() => null);
	const url = new URL(redirectTo, 'http://localhost');
	url.searchParams.set(res.ok && json?.success !== false ? 'success' : 'error', res.ok && json?.success !== false ? 'تم إنشاء مفتاح Redis بنجاح.' : (json?.message || 'تعذّر إنشاء المفتاح.'));
	return redirect(`${url.pathname}${url.search}`);
};
