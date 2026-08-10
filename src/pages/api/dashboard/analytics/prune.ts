import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { safeRedirectPath } from '../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/analytics?tab=performance')}`);
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/analytics?tab=performance');
	const requestedDays = Number.parseInt(String(form.get('days') || '90'), 10) || 90;
	const days = Math.min(3650, Math.max(30, requestedDays));
	const res = await apiRawFetch('/dashboard/visitor-analytics/prune', {
		method: 'POST', countryId: locals.countryId, cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days }),
	});
	const json: any = await res.json().catch(() => null);
	const url = new URL(redirectTo, 'http://localhost');
	const deleted = Number(json?.data?.deleted || 0);
	url.searchParams.set(res.ok && json?.success !== false ? 'success' : 'error', res.ok && json?.success !== false ? `تم تنظيف ${deleted.toLocaleString('ar-EG')} سجل قديم.` : (json?.message || 'تعذّر تنظيف بيانات التحليلات.'));
	return redirect(`${url.pathname}${url.search}`);
};
