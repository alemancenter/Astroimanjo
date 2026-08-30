import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../../lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ params, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return Response.json({ success: false, message: 'يجب تسجيل الدخول' }, { status: 401 });
	if (!['article', 'post'].includes(params.contentType || '') || !/^\d+$/.test(params.id || '')) return Response.json({ success: false, message: 'مسار غير صالح' }, { status: 400 });
	const response = await apiRawFetch(`/dashboard/seo/links/${params.contentType}/${params.id}`, { countryId: locals.countryId, cookieHeader: `token=${token}` });
	return new Response(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
};
