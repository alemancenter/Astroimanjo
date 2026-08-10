import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ params, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response(JSON.stringify({ success: false, message: 'يجب تسجيل الدخول' }), { status: 401 });

	const res = await apiRawFetch(`/dashboard/ai/status/${params.id}`, {
		method: 'GET',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
	});
	const json: any = await res.json().catch(() => null);

	return new Response(JSON.stringify(json), {
		status: res.status,
		headers: { 'Content-Type': 'application/json' },
	});
};
