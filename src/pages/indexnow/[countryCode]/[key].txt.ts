import type { APIRoute } from 'astro';
import { apiFetch } from '../../../lib/api';
import { getCountryByCode } from '../../../lib/countries';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	const country = getCountryByCode(params.countryCode || '');
	const key = params.key || '';
	if (!country || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) return new Response('Not found', { status: 404 });
	const settings = (await apiFetch<Record<string, string>>('/front/settings', { countryId: country.id })).data || {};
	if (settings.indexnow_key !== key) return new Response('Not found', { status: 404 });
	return new Response(key, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
			'X-Content-Type-Options': 'nosniff',
		},
	});
};
