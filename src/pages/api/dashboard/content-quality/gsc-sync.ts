import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// Kick off a background Search Analytics sync for one country (90 days).
export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect('/login?redirect_to=/dashboard/content-quality?tab=search');
	const form = await request.formData();
	const cc = String(form.get('country_code') || '').trim();
	const back = '/dashboard/content-quality?tab=search';
	if (!cc) return redirect(`${back}&error=${encodeURIComponent('رمز الدولة مطلوب')}`);

	const res = await apiRawFetch(`/dashboard/gsc/analytics/sync?country_code=${encodeURIComponent(cc)}&days=90`, {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		timeoutMs: 20_000,
	});
	const json: any = await res.json().catch(() => null);
	return redirect(res.ok ? `${back}&success=sync` : `${back}&error=${encodeURIComponent(json?.message || 'تعذّرت المزامنة')}`);
};
