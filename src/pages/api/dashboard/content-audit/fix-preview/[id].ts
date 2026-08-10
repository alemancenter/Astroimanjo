import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ params, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response(JSON.stringify({ success: false, message: 'غير مصرح' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
	const res = await apiRawFetch(`/dashboard/content-audit/ai/fix-preview/${params.id}`, { countryId: locals.countryId, cookieHeader: `token=${token}` });
	return new Response(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
