import { DEFAULT_COUNTRY_ID } from './countries';

// Fail fast in production instead of silently running with the wrong backend or an empty
// secret. Before this, a missing PUBLIC_API_URL in a misconfigured staging/test deploy would
// silently fall back to the real production API (`|| 'https://api.alemancenter.com/api'`),
// and a missing FRONTEND_API_KEY would just make every backend call fail with an
// authorization error instead of the actual problem being obvious at startup. Dev/test builds
// (import.meta.env.PROD === false) keep the old defaulting behavior — only a production build
// is required to have these set explicitly.
if (import.meta.env.PROD) {
	const missing = (
		[
			['PUBLIC_API_URL', import.meta.env.PUBLIC_API_URL],
			['FRONTEND_API_KEY', import.meta.env.FRONTEND_API_KEY],
			['PUBLIC_SITE_URL', import.meta.env.PUBLIC_SITE_URL],
		] as const
	)
		.filter(([, value]) => !value)
		.map(([name]) => name);

	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variable(s) for production: ${missing.join(', ')}. ` +
				'See .env.example. Refusing to start with an incomplete production configuration.'
		);
	}
}

const API_URL = import.meta.env.PUBLIC_API_URL || 'https://api.imanjo.com/api';
const API_KEY = import.meta.env.FRONTEND_API_KEY;

/** The backend's public API base — safe to use in redirect targets (no secret key needed on the receiving end). */
export const API_BASE_URL = API_URL;

export interface PaginationMeta {
	current_page: number;
	per_page: number;
	total: number;
	last_page: number;
	from: number;
	to: number;
}

export interface ApiResult<T> {
	ok: boolean;
	data: T | null;
	message: string;
	meta: PaginationMeta | null;
	status: number;
}

export interface ApiListResult<T> {
	ok: boolean;
	items: T[];
	message: string;
	meta: PaginationMeta | null;
	status: number;
}

/**
 * Maps a failed ApiResult to the HTTP status a *content* page should actually respond with.
 * Callers used to hardcode `Astro.response.status = 404` for any `!result.ok`, which meant a
 * transient backend 503 or a network timeout got served (and cached) as "this page doesn't
 * exist" — including to crawlers, which then drop the URL from the index instead of retrying
 * it. Only a genuine upstream 404 (or a 200-with-`ok:false` business response, e.g. "not
 * found" without an HTTP error) should render as 404; everything else should surface as a
 * server error so it's neither indexed as missing nor cached as permanent.
 */
export function resolveNotFoundStatus(result: Pick<ApiResult<unknown>, 'status'>): number {
	if (result.status === 404) return 404;
	if (result.status === 0) return 503; // network failure / timeout — apiFetch's own catch-all
	if (result.status >= 500) return 502;
	return 404;
}

/**
 * Sets the response status via resolveNotFoundStatus() AND opts the current request out of
 * Astro's route cache whenever that status isn't a genuine 404. Astro's cache providers store
 * whatever status a response has with no built-in check — a page with routeRules caching that
 * hit a transient backend 502/503 would otherwise get that failure cached and replayed to
 * every visitor for the rest of the maxAge window, even after the backend recovers.
 */
export function applyNotFoundStatus(
	astro: { response: { status?: number }; cache: { set(input: false): void } },
	result: Pick<ApiResult<unknown>, 'status'>
): void {
	const status = resolveNotFoundStatus(result);
	astro.response.status = status;
	if (status !== 404) astro.cache.set(false);
}

/**
 * Same failure→status/no-cache reasoning as applyNotFoundStatus, but for collection/listing
 * pages (articles, posts, categories, classes indexes) rather than single-entity pages. A
 * listing has no legitimate "this doesn't exist" case the way one article does — a zero-result
 * page is still `result.ok`, not a failure — so unlike applyNotFoundStatus there's no 404
 * exception to preserve caching for: any !result.ok here means the backend call itself failed,
 * and must surface as a real error status with caching disabled, not a silently-cached 200 with
 * an ErrorState body (which is exactly what let a transient Go API outage get served — and
 * cached — as a legitimately empty page).
 */
export function applyListStatus(
	astro: { response: { status?: number }; cache: { set(input: false): void } },
	result: Pick<ApiResult<unknown>, 'status' | 'ok'>
): void {
	if (result.ok) return;
	astro.response.status = result.status === 0 ? 503 : 502;
	astro.cache.set(false);
}

// Neither apiFetch nor apiRawFetch used to pass a `signal` at all — a stalled backend or a
// hung TCP connection meant the Astro request handling it just waited forever. 10s covers
// normal reads/writes; callers doing something known to take longer (large file uploads)
// pass an explicit override rather than get a one-size-fits-all value that's wrong for both.
const DEFAULT_TIMEOUT_MS = 10_000;
export const UPLOAD_TIMEOUT_MS = 30_000;

interface ApiFetchOptions {
	/** X-Country-Id header value — one of '1'..'4'. Defaults to Jordan. */
	countryId?: string;
	/** Query string params, falsy values are omitted. */
	params?: Record<string, string | number | boolean | undefined | null>;
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	body?: unknown;
	/** Raw `Cookie` header to forward the visitor's session to the backend (for authenticated calls from BFF routes). */
	cookieHeader?: string;
	/** Abort the request after this many ms. Defaults to DEFAULT_TIMEOUT_MS; pass UPLOAD_TIMEOUT_MS (or a custom value) for known-slow calls. */
	timeoutMs?: number;
}

function buildUrl(path: string, params?: ApiFetchOptions['params']): string {
	const url = new URL(path.startsWith('http') ? path : `${API_URL}${path}`);
	if (params) {
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== null && value !== '') {
				url.searchParams.set(key, String(value));
			}
		}
	}
	return url.toString();
}

/**
 * Server-side-only fetch wrapper around the Go backend.
 * Must never run in browser JS — it carries FRONTEND_API_KEY, a secret
 * that authorizes direct API access. Call this from Astro frontmatter or
 * from src/pages/api/** (BFF) routes only.
 */
export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<ApiResult<T>> {
	const { countryId = DEFAULT_COUNTRY_ID, params, method = 'GET', body, cookieHeader, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

	const headers: Record<string, string> = {
		'X-Country-Id': countryId,
		'X-Frontend-Key': API_KEY,
	};
	if (cookieHeader) headers['Cookie'] = cookieHeader;
	if (body !== undefined) headers['Content-Type'] = 'application/json';

	try {
		const res = await fetch(buildUrl(path, params), {
			method,
			headers,
			body: body !== undefined ? JSON.stringify(body) : undefined,
			signal: AbortSignal.timeout(timeoutMs),
		});

		const json = await res.json().catch(() => null);

		return {
			ok: res.ok && json?.success !== false,
			data: (json?.data ?? null) as T | null,
			message: json?.message ?? (res.ok ? '' : `تعذّر جلب البيانات (${res.status})`),
			meta: json?.meta ?? json?.pagination ?? null,
			status: res.status,
		};
	} catch (err) {
		const timedOut = err instanceof Error && err.name === 'TimeoutError';
		console.error(`[apiFetch] ${path} failed${timedOut ? ' (timeout)' : ''}:`, err);
		return {
			ok: false,
			data: null,
			message: timedOut ? 'انتهت مهلة الاتصال بالخادم، يرجى المحاولة لاحقًا.' : 'تعذّر الاتصال بالخادم، يرجى المحاولة لاحقًا.',
			meta: null,
			status: 0,
		};
	}
}

/**
 * Raw fetch to the backend, for BFF routes (src/pages/api/**) that need
 * access to the actual Response — status, headers (e.g. Set-Cookie on
 * auth endpoints), not just the parsed envelope. Server-side only, same
 * secret-key rules as apiFetch.
 */
export async function apiRawFetch(
	path: string,
	options: ApiFetchOptions & { headers?: Record<string, string> } = {}
): Promise<Response> {
	const { countryId = DEFAULT_COUNTRY_ID, params, method = 'GET', body, cookieHeader, headers: extraHeaders, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

	const headers: Record<string, string> = {
		'X-Country-Id': countryId,
		'X-Frontend-Key': API_KEY,
		...extraHeaders,
	};
	if (cookieHeader) headers['Cookie'] = cookieHeader;

	return fetch(buildUrl(path, params), {
		method,
		headers,
		body: body as BodyInit | undefined,
		signal: AbortSignal.timeout(timeoutMs),
	});
}

/** Pulls a specific cookie's value out of a backend response's Set-Cookie headers. */
export function extractSetCookieValue(response: Response, name: string): string | null {
	const setCookieHeaders =
		typeof (response.headers as any).getSetCookie === 'function' ? (response.headers as any).getSetCookie() : [];
	for (const header of setCookieHeaders as string[]) {
		const match = header.match(new RegExp(`^${name}=([^;]+)`));
		if (match) return decodeURIComponent(match[1]);
	}
	return null;
}

/** Convenience wrapper for list endpoints — always resolves to an array, even on failure. */
export async function apiFetchList<T = unknown>(
	path: string,
	options: ApiFetchOptions = {}
): Promise<ApiListResult<T>> {
	const result = await apiFetch<T[]>(path, options);
	return {
		ok: result.ok,
		items: Array.isArray(result.data) ? result.data : [],
		message: result.message,
		meta: result.meta,
		status: result.status,
	};
}
