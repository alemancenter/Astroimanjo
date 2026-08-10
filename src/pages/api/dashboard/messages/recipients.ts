import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response(JSON.stringify({ success: false, data: [] }), { status: 401, headers: { 'Content-Type': 'application/json' } });
	const q = new URL(request.url).searchParams.get('q')?.trim() || '';
	const response = await apiRawFetch('/user/search', {
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		params: { q },
	});
	const body = await response.text();
	return new Response(body, { status: response.status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
