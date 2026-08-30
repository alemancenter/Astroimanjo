import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { isValidCountryCode } from '../../../../../lib/countries';

export const prerender = false;

// Sets the Search Console site_url property for one country. Since this site
// serves all countries under one shared domain (imanjo.com, /countryCode/
// paths, not separate per-country domains), the same site_url is expected to
// be registered for every country — see plan §4.1.
export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/gsc')}`);

	const form = await request.formData();
	const countryCode = String(form.get('country_code') || '');
	const siteUrl = String(form.get('site_url') || '').trim();

	if (!isValidCountryCode(countryCode)) {
		return redirect(`/dashboard/gsc?error=${encodeURIComponent('رمز دولة غير صحيح')}`);
	}
	if (!siteUrl) {
		return redirect(`/dashboard/gsc?error=${encodeURIComponent('site_url مطلوب')}`);
	}

	const res = await apiRawFetch(`/dashboard/gsc/properties/${countryCode}`, {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ site_url: siteUrl, active: true }),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`/dashboard/gsc?error=${encodeURIComponent(json?.message || 'تعذّر حفظ الخاصية')}`);
	}

	return redirect('/dashboard/gsc?success=1');
};
