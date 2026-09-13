import type { APIRoute } from 'astro';
import { safeRedirectPath } from '../../../../lib/safe-redirect';

export const prerender = false;

// This is a real top-level browser navigation (the user clicks a link, not a fetch), unlike
// every other backend call in this app — Astro can't mediate it through apiFetch/apiRawFetch
// and bridge a Set-Cookie the way social-login.ts does for the client-side token flow. It has
// to send the browser to the backend directly: PUBLIC_API_URL is the client-facing origin,
// exactly what src/lib/api.ts itself validates as safe to reach from the browser.
const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL || 'https://api.imanjo.com/api';

export const GET: APIRoute = ({ url, redirect }) => {
	const redirectTo = safeRedirectPath(url.searchParams.get('redirect_to'), '/');
	const target = new URL(`${PUBLIC_API_URL}/auth/google/redirect`);
	target.searchParams.set('redirect_to', redirectTo);
	return redirect(target.toString());
};
