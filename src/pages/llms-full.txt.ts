import type { APIRoute } from 'astro';
import { apiFetch } from '../lib/api';
import { COUNTRIES, DEFAULT_COUNTRY_ID } from '../lib/countries';

export const prerender = false;

const clean = (value: unknown) => String(value ?? '')
	.replace(/<script[\s\S]*?<\/script>/gi, ' ')
	.replace(/<style[\s\S]*?<\/style>/gi, ' ')
	.replace(/<[^>]+>/g, ' ')
	.replace(/[\r\n]+/g, ' ')
	.replace(/\s+/g, ' ')
	.trim();

const label = (value: unknown) => clean(value).replace(/[\[\]()]|https?:\/\/\S+/g, '');

export const GET: APIRoute = async ({ site, url }) => {
	const origin = (site?.origin || url.origin).replace(/\/$/, '');
	const settings = (await apiFetch<Record<string, string>>('/front/settings', { countryId: DEFAULT_COUNTRY_ID })).data || {};
	if (settings.llms_txt_enabled === 'false' || settings.llms_full_txt_enabled === 'false') {
		return new Response('Not found', { status: 404 });
	}
	const blocks = (await Promise.all(COUNTRIES.map(async (country) => {
		const [articles, posts] = await Promise.all([
			apiFetch<any[]>('/articles', { countryId: country.id, params: { page: 1, per_page: 100 } }),
			apiFetch<any[]>('/posts', { countryId: country.id, params: { page: 1, per_page: 100 } }),
		]);
		return [
			...(articles.data || []).map((item: any) => ({ country: country.name, title: item.title, url: `${origin}/${country.code}/lesson/articles/${item.id}`, description: item.meta_description || clean(item.content).slice(0, 300) })),
			...(posts.data || []).map((item: any) => ({ country: country.name, title: item.title, url: `${origin}/${country.code}/posts/${item.id}`, description: item.meta_description || clean(item.content).slice(0, 300) })),
		];
	}))).flat();
	const lines = [
		`# ${clean(settings.site_name || 'موقع الإيمان')} — الفهرس الموسع`,
		`> ${clean(settings.meta_description || 'منصة تعليمية عربية.')}`,
		'',
		...blocks.flatMap((item) => [
			`## ${label(item.title)} — ${item.country}`,
			`- الرابط: ${item.url}`,
			...(item.description ? [`- الوصف: ${clean(item.description)}`] : []),
			'',
		]),
	];
	return new Response(`${lines.join('\n')}\n`, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
			'X-Content-Type-Options': 'nosniff',
		},
	});
};
