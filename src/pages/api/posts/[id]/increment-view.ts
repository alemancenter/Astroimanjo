import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { getCountryByCode, DEFAULT_COUNTRY_ID } from '../../../../lib/countries';

export const prerender = false;

// Fired client-side (see the post page's inline script) rather than during SSR, because
// the post page's HTML is response-cached (astro.config.mjs routeRules) — incrementing
// the view count during render would only happen once per cache window, not once per
// visitor. `country` is passed explicitly since this route isn't under /{countryCode}/,
// so the usual path-based country resolution in middleware.ts doesn't apply here.
export const POST: APIRoute = async ({ params, url }) => {
	const countryCode = url.searchParams.get('country');
	const countryId = (countryCode && getCountryByCode(countryCode)?.id) || DEFAULT_COUNTRY_ID;

	await apiRawFetch(`/posts/${params.id}/increment-view`, {
		method: 'POST',
		countryId,
	}).catch(() => null);

	return new Response(null, { status: 204 });
};
