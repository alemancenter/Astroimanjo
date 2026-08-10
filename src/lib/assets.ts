const SITE_ORIGIN = (import.meta.env.PUBLIC_SITE_URL || 'https://imanjo.com').replace(/\/+$/, '');

/**
 * Article/post/category `image` fields come back from the API as paths relative to the
 * storage disk — e.g. "posts/xyz.jpg" or "images/posts/xyz.webp" (the upload path
 * convention changed at some point; both forms exist in the DB and must both work).
 *
 * These must NOT be built as `{api origin}/storage/{path}` — that's not reliably served
 * on the api.alemancenter.com origin (confirmed 404s across many files). The live site
 * resolves them through a dedicated resize/proxy endpoint instead, reachable only via the
 * main site's own domain — confirmed by inspecting the deployed production bundle:
 * `alemancenter.com/api/img?src=...&w=...` → 200 (webp, immutably cached),
 * `api.alemancenter.com/api/img?src=...` → 404.
 */
export function assetUrl(path: string | null | undefined, width?: number): string | null {
	if (!path) return null;
	if (/^https?:\/\//i.test(path)) return path;

	const relative = path.replace(/^\/+storage\/+/i, '').replace(/^\/+/, '');
	if (!relative) return null;

	const params = new URLSearchParams({ src: relative });
	if (width) params.set('w', String(width));
	return `${SITE_ORIGIN}/api/img?${params.toString()}`;
}
