import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../lib/api';
import { clearSessionCookies } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (token) {
		await apiRawFetch('/auth/logout', {
			method: 'POST',
			countryId: locals.countryId,
			cookieHeader: `token=${token}`,
		}).catch(() => null);
	}
	clearSessionCookies(cookies);
	return redirect('/');
};
