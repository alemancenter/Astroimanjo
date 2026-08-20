import type { APIRoute } from 'astro';
import { apiFetch } from '../lib/api';

export const prerender = false;

const PUBLIC_SITE_URL = (
	import.meta.env.PUBLIC_SITE_URL || 'https://imanjo.com'
).replace(/\/+$/, '');

const DEFAULT_ROBOTS = [
	'User-agent: *',
	'Allow: /',
	'',
	'# Private and authenticated areas',
	'Disallow: /account/',
	'Disallow: /dashboard/',
	'Disallow: /api/',
	'Disallow: /_server-islands/',
	'',
	'# Authentication and system pages',
	'Disallow: /login',
	'Disallow: /register',
	'Disallow: /forgot-password',
	'Disallow: /reset-password',
	'Disallow: /maintenance',
].join('\n');

function resolveSitemapUrl(value?: string): string {
	const fallback = `${PUBLIC_SITE_URL}/sitemap.xml`;
	const candidate = value?.trim();

	if (!candidate) {
		return fallback;
	}

	try {
		const url = new URL(candidate, `${PUBLIC_SITE_URL}/`);

		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			return fallback;
		}

		return url.toString();
	} catch {
		return fallback;
	}
}

function appendSitemap(body: string, sitemapUrl: string): string {
	const normalized = body.trim().replace(/\r\n?/g, '\n');

	if (/^\s*Sitemap\s*:/im.test(normalized)) {
		return normalized;
	}

	return `${normalized}\n\nSitemap: ${sitemapUrl}`;
}

// Always return a valid robots.txt even when the settings API is temporarily
// unavailable. Admin robots_txt remains a full override when explicitly set.
export const GET: APIRoute = async ({ locals }) => {
	let body = DEFAULT_ROBOTS;
	let sitemapUrl = `${PUBLIC_SITE_URL}/sitemap.xml`;

	try {
		const response = await apiFetch<Record<string, string>>(
			'/front/settings',
			{
				countryId: locals.countryId,
			}
		);

		const settings = response.data ?? {};
		const customRobots = settings.robots_txt?.trim();

		if (customRobots) {
			body = customRobots;
		}

		sitemapUrl = resolveSitemapUrl(settings.sitemap_url);
	} catch {
		// Safe defaults intentionally remain active.
	}

	return new Response(
		`${appendSitemap(body, sitemapUrl)}\n`,
		{
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control':
					'public, max-age=3600, stale-while-revalidate=86400',
				'X-Content-Type-Options': 'nosniff',
			},
		}
	);
};
