import { defineMiddleware } from 'astro:middleware';
import type { APIContext, MiddlewareNext } from 'astro';
import { DEFAULT_COUNTRY_ID, getCountryByCode, isValidCountryId, isValidCountryCode } from './lib/countries';
import { apiFetch } from './lib/api';
import { getCurrentUser, isAdmin } from './lib/auth';
import { runWithRequestContext } from './lib/request-context';

const COUNTRY_COOKIE = 'country_id';
const COUNTRY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Must stay reachable even while maintenance_mode is on: /login and /api/auth so an admin
// whose session lapsed can still get back in, /dashboard and /api/dashboard so they can reach
// the toggle to turn it back off, /maintenance itself to avoid rewriting to itself forever, and
// /_astro for the maintenance page's own CSS/JS.
const MAINTENANCE_EXEMPT_PREFIXES = ['/dashboard', '/api/dashboard', '/api/auth', '/login', '/maintenance', '/_astro'];

function isMaintenanceExempt(pathname: string): boolean {
	return MAINTENANCE_EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// The "وضع الصيانة" dashboard toggle set maintenance_mode in the DB, but nothing in the
// frontend ever read it — an admin could switch it on and the public site would keep serving
// normally with no visible change at all. Also had to add maintenance_mode to the Go backend's
// publicSettingKeys allowlist (setting_service.go) since /front/settings silently dropped it
// before this, same failure shape as require_login_for_download's fix earlier this project.
async function checkMaintenanceMode(context: APIContext): Promise<Response | null> {
	const settingsResult = await apiFetch<Record<string, string>>('/front/settings', {
		countryId: context.locals.countryId,
	});
	if (!settingsResult.ok || settingsResult.data?.maintenance_mode !== 'true') return null;

	// Logged-in admins can still preview the live site while it's down for everyone else —
	// otherwise there's no way to verify a fix before flipping the toggle back off.
	const user = await getCurrentUser(context);
	if (isAdmin(user)) return null;

	const maintenance = await context.rewrite('/maintenance');
	return new Response(maintenance.body, { status: 503, headers: maintenance.headers });
}

export const onRequest = defineMiddleware(async (context, next) => {
	// clientAddress throws on prerendered routes (no real per-visitor request exists there) —
	// same guard shape as the cookie read below. request.headers is always safe to read.
	const clientIp = context.isPrerendered ? '' : context.clientAddress;
	const userAgent = context.request.headers.get('user-agent') ?? '';
	const referer = context.request.headers.get('referer') ?? '';
	return runWithRequestContext({ clientIp, userAgent, referer }, () => handleRequest(context, next));
});

async function handleRequest(context: APIContext, next: MiddlewareNext) {
	// Country-scoped routes (/{countryCode}/lesson/**, /{countryCode}/posts/**) encode the
	// country in the path itself — that's the public, SEO-facing URL shape, so it's the
	// source of truth here and never falls back to the cookie/query mechanism below.
	const pathCountryCode = context.params.countryCode;
	if (pathCountryCode) {
		if (!isValidCountryCode(pathCountryCode)) {
			const notFound = await context.rewrite('/404');
			return new Response(notFound.body, { status: 404, headers: notFound.headers });
		}
		const country = getCountryByCode(pathCountryCode)!;
		context.locals.countryId = country.id;
		context.locals.countryCode = country.code;
	} else {
		const queryCountry = context.url.searchParams.get('country');
		// Statically prerendered routes (the legal/about pages) are built once with no real visitor
		// request behind them — reading/writing cookies there is meaningless (there's nothing to
		// persist to) and is exactly what Astro's "Astro.request.headers on a prerendered page"
		// build warning is flagging. Skip the cookie round-trip during prerendering and fall
		// through to the default country, which is what this would resolve to anyway.
		const cookieCountry = context.isPrerendered ? undefined : context.cookies.get(COUNTRY_COOKIE)?.value;

		let countryId = DEFAULT_COUNTRY_ID;
		if (isValidCountryId(queryCountry)) {
			countryId = queryCountry;
		} else if (isValidCountryId(cookieCountry)) {
			countryId = cookieCountry;
		}

		// Persist explicit switches (?country=) so subsequent navigation without
		// the query param still resolves to the chosen country.
		if (!context.isPrerendered && isValidCountryId(queryCountry) && queryCountry !== cookieCountry) {
			context.cookies.set(COUNTRY_COOKIE, countryId, {
				path: '/',
				maxAge: COUNTRY_COOKIE_MAX_AGE,
				sameSite: 'lax',
			});
		}

		context.locals.countryId = countryId;
	}

	if (!context.isPrerendered && !isMaintenanceExempt(context.url.pathname)) {
		const maintenanceResponse = await checkMaintenanceMode(context);
		if (maintenanceResponse) return maintenanceResponse;
	}

	return next();
}
