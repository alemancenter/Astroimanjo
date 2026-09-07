import type { APIRoute } from 'astro';
import { getCountryByCode } from '../../lib/countries';

export const prerender = false;

const INTERNAL_API_URL = import.meta.env.INTERNAL_API_URL || 'http://127.0.0.1:8187/api';
const INTERNAL_ORIGIN = new URL(INTERNAL_API_URL).origin;

export const GET: APIRoute = async ({ params }) => {
	const country = getCountryByCode(params.countryCode || '');
	if (!country) return new Response('Not found', { status: 404 });

	try {
		const upstream = await fetch(
			`${INTERNAL_ORIGIN}/storage/sitemaps/sitemap_index_${country.code}.xml`,
			{ signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/xml,text/xml' } },
		);
		if (!upstream.ok) {
			return new Response('Sitemap unavailable', { status: upstream.status === 404 ? 404 : 502 });
		}
		return new Response(await upstream.text(), {
			headers: {
				'Content-Type': 'application/xml; charset=utf-8',
				'Cache-Control': 'public, max-age=300',
				'X-Robots-Tag': 'noindex',
			},
		});
	} catch {
		return new Response('Sitemap unavailable', { status: 502 });
	}
};
