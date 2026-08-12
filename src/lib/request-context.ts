import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
	/** The real visitor's IP, from Astro.clientAddress (see middleware.ts). Empty on
	 * prerendered routes, where there's no real per-visitor request to read it from. */
	clientIp: string;
	/** The real visitor's browser User-Agent. Node's fetch() never forwards headers from an
	 * unrelated incoming request automatically, so without this, every apiFetch() call to the
	 * Go backend showed up there with no (or Node's own default) User-Agent — the visitor
	 * tracking pipeline's browser/OS/device-type/bot classification all derive from this one
	 * string, so losing it made all of them silently show "unknown" regardless of who the real
	 * visitor was. */
	userAgent: string;
	/** The real visitor's Referer header, for the same reason as userAgent — traffic-source
	 * attribution reads this from the Go backend's side. */
	referer: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Wraps a request's full handling so any apiFetch()/apiRawFetch() call made anywhere during
 * it — page frontmatter, components, BFF routes — can see the real visitor's request details
 * without every one of those call sites needing to thread them through manually. See
 * middleware.ts, the only caller: it's the one place with access to the real incoming request
 * for every request. */
export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
	return storage.run(context, callback);
}

/** The current request's real visitor IP, or undefined outside a request (or on a prerendered
 * route, where none exists). Used by apiFetch/apiRawFetch to set X-Forwarded-For on calls to
 * the Go backend — without it, every server-to-server call arrives from this Node process's
 * own address instead of the actual visitor's, breaking IP-based geolocation, visitor
 * deduplication, and any IP-based rate limiting/blocking on the backend. */
export function getClientIp(): string | undefined {
	return storage.getStore()?.clientIp || undefined;
}

/** The current request's real visitor User-Agent, or undefined outside a request. */
export function getClientUserAgent(): string | undefined {
	return storage.getStore()?.userAgent || undefined;
}

/** The current request's real visitor Referer, or undefined outside a request. */
export function getClientReferer(): string | undefined {
	return storage.getStore()?.referer || undefined;
}
