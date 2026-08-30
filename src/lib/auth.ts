import { createHash } from 'node:crypto';
import { apiFetch } from './api';

export interface Permission {
	id: number;
	name: string;
}

export interface Role {
	id: number;
	name: string;
	permissions?: Permission[];
}

export interface SocialLinks {
	facebook?: string;
	twitter?: string;
	linkedin?: string;
	instagram?: string;
	github?: string;
}

export interface AuthUser {
	id: number;
	name: string;
	email: string;
	email_verified_at: string | null;
	status?: string;
	phone?: string | null;
	job_title?: string | null;
	gender?: 'male' | 'female' | 'other' | null;
	country?: string | null;
	bio?: string | null;
	social_links?: SocialLinks | null;
	profile_photo_path?: string | null;
	profile_photo_url?: string | null;
	roles: Role[];
	permissions?: Permission[];
	created_at?: string;
	last_activity?: string | null;
}

interface AuthContext {
	cookies: {
		get(name: string): { value: string } | undefined;
		/** Optional: only getCurrentUser()'s token-refresh path needs write access. */
		set?(name: string, value: string, opts: Record<string, unknown>): void;
		delete?(name: string, opts?: Record<string, unknown>): void;
	};
	locals?: { countryId?: string };
}

// A single page visit can trigger several independent requests to this server that all need
// to know who's logged in: the main page render, and each Header UserMenu Server Island
// (desktop + mobile each fetch /_server-islands/UserMenu separately — they are genuinely
// separate HTTP requests, not just separate renders within one request, so per-request
// memoization like Astro.locals can't dedupe them). Without this, a single visit to a page
// with both UserMenu islands plus its own getCurrentUser() call (e.g. the article page's
// comment form) fires 3 separate GET /auth/user calls at the backend for the exact same
// visitor. Caching the in-flight/resolved promise per token for a few seconds collapses
// those into one real backend call — short enough that a login/logout is reflected on the
// very next unrelated page view, long enough to cover the handful of near-simultaneous
// sub-requests one page load produces.
const USER_CACHE_TTL_MS = 5000;
const USER_CACHE_MAX_ENTRIES = 500;

interface RefreshedSession {
	token: string;
	refreshToken: string | null;
}

interface UserResolution {
	user: AuthUser | null;
	session?: RefreshedSession;
	clearSession?: boolean;
}

type RefreshResolution =
	| { kind: 'success'; session: RefreshedSession }
	| { kind: 'invalid' }
	| { kind: 'transient' };

// /auth/user dedupe remains useful because one page can render several
// independent Astro server requests for the same visitor. Unlike the old
// implementation, the cached promise returns data only — it never writes to
// the first request's cookie jar.
const userCache = new Map<
	string,
	{ value: Promise<UserResolution>; expiresAt: number }
>();

// Single-flight refresh is intentionally process-local. imanjo-frontend.service
// runs one standalone Node process, so all concurrent SSR requests in this
// frontend instance share this map.
const refreshFlights = new Map<string, Promise<RefreshResolution>>();

async function refreshSessionSingleFlight(
	countryId: string,
	refreshToken: string,
): Promise<RefreshResolution> {
	// The refresh credential itself is globally single-use at the backend.
	// Do not partition its single-flight by country: two concurrent requests
	// carrying the same refresh token must always join the same rotation.
	// Hashing also avoids retaining the raw credential as a Map key.
	const key = createHash('sha256')
		.update(refreshToken)
		.digest('hex');

	const existing = refreshFlights.get(key);
	if (existing) return existing;

	let flight: Promise<RefreshResolution>;

	flight = (async () => {
		const refreshed = await apiFetch<{
			token: string;
			refresh_token: string;
		}>('/auth/refresh', {
			method: 'POST',
			countryId,
			cookieHeader: `refresh_token=${refreshToken}`,
		});

		if (
			refreshed.ok &&
			refreshed.data?.token
		) {
			return {
				kind: 'success' as const,
				session: {
					token: refreshed.data.token,
					refreshToken:
						refreshed.data.refresh_token ?? null,
				},
			};
		}

		// The backend uses 401 for an invalid, expired, consumed, or replayed
		// refresh credential. Those credentials must be discarded locally.
		if (refreshed.status === 401) {
			return { kind: 'invalid' as const };
		}

		// Network failures (status 0) and 5xx errors are transient. Do not erase
		// a potentially valid session because the backend was temporarily
		// unreachable.
		return { kind: 'transient' as const };
	})().finally(() => {
		if (refreshFlights.get(key) === flight) {
			refreshFlights.delete(key);
		}
	});

	refreshFlights.set(key, flight);
	return flight;
}

function applyUserResolution(
	context: AuthContext,
	resolution: UserResolution,
): void {
	// Every waiter applies the successful token pair to its OWN Astro response.
	// This is the key difference from the old shared Promise implementation.
	if (resolution.session && context.cookies.set) {
		setSessionCookies(
			context.cookies as CookieJar,
			resolution.session.token,
			resolution.session.refreshToken,
		);
	}

	if (resolution.clearSession && context.cookies.delete) {
		clearSessionCookies(context.cookies as CookieJar);
	}
}

async function resolveCurrentUser(
	token: string,
	refreshToken: string | undefined,
	countryId: string,
	canPersistCookies: boolean,
): Promise<UserResolution> {
	const result = await apiFetch<AuthUser>('/auth/user', {
		countryId,
		cookieHeader: `token=${token}`,
	});

	if (result.ok) {
		return { user: result.data };
	}

	// Do not turn network/5xx/backend failures into refresh attempts.
	if (result.status !== 401) {
		return { user: null };
	}

	if (!refreshToken || !canPersistCookies) {
		return { user: null };
	}

	const refreshed = await refreshSessionSingleFlight(
		countryId,
		refreshToken,
	);

	if (refreshed.kind === 'invalid') {
		return {
			user: null,
			clearSession: true,
		};
	}

	if (refreshed.kind === 'transient') {
		return { user: null };
	}

	const retry = await apiFetch<AuthUser>('/auth/user', {
		countryId,
		cookieHeader: `token=${refreshed.session.token}`,
	});

	if (retry.ok) {
		return {
			user: retry.data,
			session: refreshed.session,
		};
	}

	// A newly issued access token that is immediately rejected as unauthorized
	// should not remain in the browser. For transient retry failures, preserve
	// the newly rotated credentials so the next request can retry normally.
	if (retry.status === 401) {
		return {
			user: null,
			clearSession: true,
		};
	}

	return {
		user: null,
		session: refreshed.session,
	};
}

/**
 * Reads the session cookie set by the backend on login (`token`) and resolves
 * the current user server-side via GET /auth/user. Returns null for guests
 * or an expired/invalid session — callers should treat null as "logged out",
 * never throw.
 */
export async function getCurrentUser(
	context: AuthContext,
): Promise<AuthUser | null> {
	const token = context.cookies.get('token')?.value;
	if (!token) return null;

	const refreshToken =
		context.cookies.get('refresh_token')?.value;

	const countryId = context.locals?.countryId ?? '';
	const canPersistCookies = Boolean(context.cookies.set);

	// Include refresh-token/cookie-write state in the key so a resolution that
	// performed refresh cannot accidentally be reused by a context with a
	// different session family or one that cannot persist new credentials.
	const cacheKey =
		`${countryId}:${token}:${refreshToken ?? ''}:` +
		`${canPersistCookies ? 'write' : 'read'}`;

	const now = Date.now();
	const cached = userCache.get(cacheKey);

	if (cached && cached.expiresAt > now) {
		const resolution = await cached.value;
		applyUserResolution(context, resolution);
		return resolution.user;
	}

	const value = resolveCurrentUser(
		token,
		refreshToken,
		countryId,
		canPersistCookies,
	);

	userCache.set(cacheKey, {
		value,
		expiresAt: now + USER_CACHE_TTL_MS,
	});

	if (userCache.size > USER_CACHE_MAX_ENTRIES) {
		for (const [key, entry] of userCache) {
			if (entry.expiresAt <= now) {
				userCache.delete(key);
			}
		}

		while (userCache.size > USER_CACHE_MAX_ENTRIES) {
			const oldestKey = userCache.keys().next().value;
			if (oldestKey === undefined) break;
			userCache.delete(oldestKey);
		}
	}

	const resolution = await value;
	applyUserResolution(context, resolution);

	return resolution.user;
}

export function isAdmin(user: AuthUser | null): boolean {
	return !!user?.roles?.some((r) => r.name === 'Admin' || r.name === 'Super Admin');
}

export function hasPermission(user: AuthUser | null, permission: string): boolean {
	if (!user) return false;
	if (isAdmin(user)) return true;
	if (user.permissions?.some((p) => p.name === permission)) return true;
	return user.roles?.some((r) => r.permissions?.some((p) => p.name === permission)) ?? false;
}

interface CookieJar {
	set(name: string, value: string, opts: Record<string, unknown>): void;
	delete(name: string, opts?: Record<string, unknown>): void;
}

const isProd = import.meta.env.PROD;

/** Mirrors the backend's own cookie lifetimes (JWT_EXPIRE_HOURS=24, JWT_REFRESH_HOURS=168) — see back/.env. */
export function setSessionCookies(cookies: CookieJar, token: string | null, refreshToken: string | null): void {
	if (token) {
		cookies.set('token', token, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 });
	}
	if (refreshToken) {
		cookies.set('refresh_token', refreshToken, {
			httpOnly: true,
			secure: isProd,
			sameSite: 'lax',
			path: '/',
			maxAge: 60 * 60 * 24 * 7,
		});
	}
}

export function clearSessionCookies(cookies: CookieJar): void {
	cookies.delete('token', { path: '/' });
	cookies.delete('refresh_token', { path: '/' });
}

/**
 * Standard guard for every /dashboard/** page: redirects to login if the
 * visitor has no session, or back to the dashboard home if they lack the
 * required permission. Callers must `return` the redirect immediately:
 *
 *   const guard = await requireDashboard(Astro, 'manage articles');
 *   if ('redirect' in guard) return guard.redirect;
 *   const { user } = guard;
 */
export async function requireDashboard(
	Astro: { redirect(path: string): Response; url: URL } & AuthContext,
	permission?: string | string[]
): Promise<{ user: AuthUser } | { redirect: Response }> {
	const user = await getCurrentUser(Astro);
	if (!user) {
		return { redirect: Astro.redirect(`/login?redirect_to=${encodeURIComponent(Astro.url.pathname)}`) };
	}
	const allowed = Array.isArray(permission)
		? permission.some((name) => hasPermission(user, name))
		: hasPermission(user, permission ?? 'access dashboard');
	if (!allowed) {
		return { redirect: Astro.redirect(`/dashboard?error=${encodeURIComponent('ليست لديك الصلاحية اللازمة للوصول إلى هذه الصفحة.')}`) };
	}
	return { user };
}
