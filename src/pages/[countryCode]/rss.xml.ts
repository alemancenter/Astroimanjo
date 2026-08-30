import type { APIRoute } from 'astro';
import { buildRSS } from '../../lib/rss';
import { getCountryByCode } from '../../lib/countries';
export const prerender = false;
export const GET: APIRoute = async ({ params, site, url }) => { const country=getCountryByCode(params.countryCode||''); if(!country)return new Response('Not found',{status:404}); return buildRSS(country.id,country.code,(site?.origin||url.origin).replace(/\/$/,'')); };
