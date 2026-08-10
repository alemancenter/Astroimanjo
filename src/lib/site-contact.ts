import { apiFetch } from './api';

export interface SiteContactInfo {
	/** e.g. "https://imanjo.com" — from Astro.site (PUBLIC_SITE_URL), not hardcoded. */
	siteOrigin: string;
	/** e.g. "imanjo.com" — same source, host only. */
	siteHost: string;
	/** From the contact_email setting; falls back to info@{siteHost} instead of a hardcoded domain, so it still makes sense if the site is ever deployed under a different domain. */
	contactEmail: string;
}

interface AstroLike {
	site?: URL;
	locals: { countryId: string };
}

export async function getSiteContactInfo(astro: AstroLike): Promise<SiteContactInfo> {
	const siteOrigin = astro.site?.origin ?? 'https://imanjo.com';
	const siteHost = astro.site?.hostname ?? 'imanjo.com';
	const settings = (await apiFetch<Record<string, string>>('/front/settings', { countryId: astro.locals.countryId })).data ?? {};
	const contactEmail = settings.contact_email?.trim() || `info@${siteHost}`;
	return { siteOrigin, siteHost, contactEmail };
}
