import type { APIRoute } from 'astro';
import { safeRedirectPath } from '../../../../lib/safe-redirect';

export const prerender = false;

// See src/pages/api/auth/google/redirect.ts for why this sends the browser to the backend
// directly instead of going through apiFetch/apiRawFetch.
const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL || 'https://api.imanjo.com/api';

export const GET: APIRoute = ({ url, redirect }) => {
	const redirectTo = safeRedirectPath(url.searchParams.get('redirect_to'), '/');
	const target = new URL(`${PUBLIC_API_URL}/auth/facebook/redirect`);
	target.searchParams.set('redirect_to', redirectTo);
	return redirect(target.toString());
};
