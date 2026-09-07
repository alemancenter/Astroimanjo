import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { getCountryByCode, DEFAULT_COUNTRY_ID } from '../../../../lib/countries';

export const prerender = false;

// A separate event records real visits independently of rendering.
export const POST: APIRoute = async ({ params, url }) => {
	const countryCode = url.searchParams.get('country');
	const countryId = (countryCode && getCountryByCode(countryCode)?.id) || DEFAULT_COUNTRY_ID;

	await apiRawFetch(`/articles/${params.id}/increment-view`, {
		method: 'POST',
		countryId,
	}).catch(() => null);

	return new Response(null, { status: 204 });
};
