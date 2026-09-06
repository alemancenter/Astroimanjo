import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

const COUNTRIES = new Set(['jo', 'sa', 'eg', 'ps']);

// Save the Search Console property (sc-domain:… or https://…) for one country.
export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect('/login?redirect_to=/dashboard/content-quality?tab=search');
	const form = await request.formData();
	const cc = String(form.get('country_code') || '').trim();
	let siteUrl = String(form.get('site_url') || '').trim();
	const back = '/dashboard/content-quality?tab=search';
	if (!COUNTRIES.has(cc) || !siteUrl) return redirect(`${back}&error=${encodeURIComponent('بيانات غير صالحة')}`);
	// Accept a bare domain ("imanjo.com") and turn it into a valid GSC domain
	// property. The backend only accepts "sc-domain:…" or a full http(s) URL.
	if (!siteUrl.includes(':') && !siteUrl.includes('/')) siteUrl = `sc-domain:${siteUrl}`;
	else if (/^https?:\/\//i.test(siteUrl) && !siteUrl.endsWith('/')) siteUrl = `${siteUrl}/`;

	const res = await apiRawFetch(`/dashboard/gsc/properties/${cc}`, {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ site_url: siteUrl, active: true }),
	});
	const json: any = await res.json().catch(() => null);
	return redirect(res.ok ? `${back}&success=property` : `${back}&error=${encodeURIComponent(json?.message || 'تعذّر الحفظ')}`);
};
