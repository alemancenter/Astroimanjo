import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect, cache }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/settings')}`);

	const form = await request.formData();
	const requestedTab = String(form.get('_return_tab') || 'general');
	const returnTab = ['general', 'brand', 'seo', 'auth', 'mail', 'advanced'].includes(requestedTab) ? requestedTab : 'general';
	const payload: Record<string, string> = {};
	for (const [key, value] of form.entries()) {
		if (typeof value === 'string' && !key.startsWith('_')) payload[key] = value;
	}

	const res = await apiRawFetch('/dashboard/settings', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`/dashboard/settings?tab=${returnTab}&error=${encodeURIComponent(json?.message || 'تعذّر حفظ الإعدادات')}`);
	}

	// Settings (site name, logo, colors, meta tags, AdSense/GA IDs, social links...) render
	// via Layout.astro on every cached page, not just one content type — so a save here needs
	// to drop every route-cache tag currently in use (astro.config.mjs routeRules), not just
	// one. Without this, a changed logo/name could keep showing the old value on cached pages
	// until their own maxAge naturally expires.
	await cache.invalidate({ tags: ['classes', 'categories', 'articles', 'subjects', 'posts'] });

	return redirect(`/dashboard/settings?tab=${returnTab}&success=1`);
};
