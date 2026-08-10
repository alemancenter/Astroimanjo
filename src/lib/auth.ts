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
const userCache = new Map<string, { value: Promise<AuthUser | null>; expiresAt: number }>();

/**
 * Reads the session cookie set by the backend on login (`token`) and resolves
 * the current user server-side via GET /auth/user. Returns null for guests
 * or an expired/invalid session — callers should treat null as "logged out",
 * never throw.
 */
export async function getCurrentUser(context: AuthContext): Promise<AuthUser | null> {
	const token = context.cookies.get('token')?.value;
	if (!token) return null;

	// /auth/user's response (roles, permissions, account state) varies by X-Country-Id — the
	// same token can legitimately resolve differently per country database. Keying the cache
	// by token alone let a request in one country serve a just-cached response meant for
	// another, for up to the 5s TTL.
	const countryId = context.locals?.countryId ?? '';
	const cacheKey = `${countryId}:${token}`;

	const now = Date.now();
	const cached = userCache.get(cacheKey);
	if (cached && cached.expiresAt > now) {
		return cached.value;
	}

	const value = apiFetch<AuthUser>('/auth/user', {
		countryId: context.locals?.countryId,
		cookieHeader: `token=${token}`,
	}).then(async (result) => {
		if (result.ok) return result.data;

		// `token` is a 24h JWT, `refresh_token` a 7-day one (back/.env: JWT_EXPIRE_HOURS=24,
		// JWT_REFRESH_HOURS=168) — but nothing ever exchanged the latter for a new `token`, so
		// a visitor was silently logged out ~24h into a session the refresh cookie still
		// covers for another 6 days. Only worth attempting when we can actually persist the
		// new cookies (cookies.set present — always true for real Astro/API route contexts).
		const refreshToken = context.cookies.get('refresh_token')?.value;
		if (!refreshToken || !context.cookies.set) return null;

		const refreshed = await apiFetch<{ token: string; refresh_token: string }>('/auth/refresh', {
			method: 'POST',
			countryId: context.locals?.countryId,
			cookieHeader: `refresh_token=${refreshToken}`,
		});
		if (!refreshed.ok || !refreshed.data?.token) return null;

		setSessionCookies(context.cookies as CookieJar, refreshed.data.token, refreshed.data.refresh_token ?? null);

		const retry = await apiFetch<AuthUser>('/auth/user', {
			countryId: context.locals?.countryId,
			cookieHeader: `token=${refreshed.data.token}`,
		});
		return retry.ok ? retry.data : null;
	});

	userCache.set(cacheKey, { value, expiresAt: now + USER_CACHE_TTL_MS });
	if (userCache.size > USER_CACHE_MAX_ENTRIES) {
		for (const [key, entry] of userCache) {
			if (entry.expiresAt <= now) userCache.delete(key);
		}
	}
	return value;
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
	permission?: string
): Promise<{ user: AuthUser } | { redirect: Response }> {
	const user = await getCurrentUser(Astro);
	if (!user) {
		return { redirect: Astro.redirect(`/login?redirect_to=${encodeURIComponent(Astro.url.pathname)}`) };
	}
	if (!hasPermission(user, permission ?? 'access dashboard')) {
		return { redirect: Astro.redirect(`/dashboard?error=${encodeURIComponent('ليست لديك الصلاحية اللازمة للوصول إلى هذه الصفحة.')}`) };
	}
	return { user };
}
