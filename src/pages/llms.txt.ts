import type { APIRoute } from 'astro';
import { apiFetch } from '../lib/api';
import { COUNTRIES, DEFAULT_COUNTRY_ID } from '../lib/countries';

export const prerender = false;

const singleLine = (value: unknown) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
const markdownLabel = (value: unknown) => singleLine(value).replace(/[\[\]()]|https?:\/\/\S+/g, '');

export const GET: APIRoute = async ({ site, url }) => {
	const origin = (site?.origin || url.origin).replace(/\/$/, '');
	const settings = (await apiFetch<Record<string, string>>('/front/settings', { countryId: DEFAULT_COUNTRY_ID })).data || {};
	if (settings.llms_txt_enabled === 'false') return new Response('Not found', { status: 404 });

	const countryContent = await Promise.all(COUNTRIES.map(async (country) => {
		const [articles, posts] = await Promise.all([
			apiFetch<any[]>('/articles', { countryId: country.id, params: { page: 1, per_page: 50 } }),
			apiFetch<any[]>('/posts', { countryId: country.id, params: { page: 1, per_page: 50 } }),
		]);
		return { country, articles: articles.data || [], posts: posts.data || [] };
	}));
	const lines = [
		`# ${singleLine(settings.site_name || 'موقع الإيمان')}`,
		`> ${singleLine(settings.meta_description || 'منصة تعليمية عربية.')}`,
		'',
		'## الروابط الأساسية',
		...countryContent.flatMap(({ country }) => [
			`- [${country.name}](${origin}/${country.code})`,
			`- [RSS ${country.name}](${origin}/${country.code}/rss.xml)`,
		]),
		`- [خريطة الموقع](${origin}/sitemap.xml)`,
		'',
		...countryContent.flatMap(({ country, articles, posts }) => [
			`## أحدث محتوى ${country.name}`,
			...articles.map((item: any) => `- [${markdownLabel(item.title)}](${origin}/${country.code}/lesson/articles/${item.id})`),
			...posts.map((item: any) => `- [${markdownLabel(item.title)}](${origin}/${country.code}/posts/${item.id})`),
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
