/**
 * Guards `redirect_to`/`referer`-style values (read from form fields or
 * headers, therefore attacker-controlled) before they're ever passed to a
 * `redirect()` call. Only same-origin destinations are allowed — anything
 * else (a `//evil.com` protocol-relative URL, an absolute `https://evil.com`
 * URL, or a cross-origin referer) falls back to a safe default instead of
 * being followed, which is what closes an open-redirect hole.
 *
 * Deliberately does NOT use a `input.startsWith('/') && !input.startsWith('//')`
 * string-prefix check — that was the previous implementation, and it's bypassable:
 * WHATWG URL parsing treats a backslash exactly like a forward slash for special
 * schemes (http/https), so `/\evil.com` passes a naive "starts with one slash,
 * not two" check yet still resolves to host `evil.com` (`new URL('/\\evil.com',
 * 'http://x').host === 'evil.com'`), which is exactly the open-redirect this
 * function exists to prevent. Parsing with `new URL()` and comparing the
 * resulting *origin* — rather than pattern-matching the raw string — closes
 * that class of bypass (and any equivalent one) by construction, since the
 * browser will resolve the redirect the same way this function just did.
 */
export function safeRedirectPath(input: string | null | undefined, fallback: string, origin?: string): string {
	if (!input) return fallback;

	// No real origin known at this call site (most callers — a same-origin form
	// post that only needs "stay somewhere on this site"): resolve against a
	// placeholder base and accept only paths that don't specify a different host.
	const base = origin ?? 'http://internal.invalid';

	try {
		const url = new URL(input, base);
		if (url.origin === new URL(base).origin) {
			return url.pathname + url.search + url.hash;
		}
	} catch {
		// Not a parseable URL — fall through to the fallback below.
	}

	return fallback;
}
