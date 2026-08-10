import type { APIRoute } from 'astro';
import { apiFetch } from '../lib/api';

export const prerender = false;

// robots_txt (admin-editable full override) and sitemap_url both exist in Settings but had
// no public consumer — this is that consumer. Falls back to a sensible default (allow
// everything) when the admin hasn't set a custom robots.txt.
export const GET: APIRoute = async ({ locals }) => {
	const settings = (await apiFetch<Record<string, string>>('/front/settings', { countryId: locals.countryId })).data ?? {};
	const custom = settings.robots_txt?.trim();
	const sitemapUrl = settings.sitemap_url?.trim();

	const body = custom || ['User-agent: *', 'Allow: /'].join('\n');
	const withSitemap = sitemapUrl && !body.includes('Sitemap:') ? `${body}\n\nSitemap: ${sitemapUrl}` : body;

	return new Response(withSitemap + '\n', {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
