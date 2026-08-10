import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { getCountryByCode, DEFAULT_COUNTRY_ID } from '../../../../lib/countries';

export const prerender = false;

// Fired client-side (see the article page's inline script) rather than during SSR, because
// the article page's HTML is now response-cached (astro.config.mjs routeRules) — the
// backend increments visit_count as a side effect of GET /articles/:id (article_service.go
// GetByID → ViewCounter.IncrementArticleView), so relying on the SSR fetch would only bump
// the count once per cache window, not once per visitor. Unlike posts/files, the backend has
// no dedicated increment-view endpoint for articles — re-issuing the same GET server-side
// (discarding the body) is the only way to trigger that side effect per real visitor without
// a backend change. `country` is passed explicitly since this route isn't under
// /{countryCode}/, so the usual path-based country resolution in middleware.ts doesn't apply.
export const POST: APIRoute = async ({ params, url }) => {
	const countryCode = url.searchParams.get('country');
	const countryId = (countryCode && getCountryByCode(countryCode)?.id) || DEFAULT_COUNTRY_ID;

	await apiRawFetch(`/articles/${params.id}`, {
		method: 'GET',
		countryId,
	}).catch(() => null);

	return new Response(null, { status: 204 });
};
