import type { APIRoute } from 'astro';
import { buildRSS } from '../lib/rss';
import { DEFAULT_COUNTRY_CODE, DEFAULT_COUNTRY_ID } from '../lib/countries';
export const prerender = false;
// Keep the root feed deterministic. Choosing a country from the visitor's
// cookie while returning a publicly cacheable response could serve one
// visitor's country feed to everyone else. Country-specific feeds remain at
// /{countryCode}/rss.xml.
export const GET: APIRoute = ({site,url}) => buildRSS(DEFAULT_COUNTRY_ID,DEFAULT_COUNTRY_CODE,(site?.origin||url.origin).replace(/\/$/,''));
