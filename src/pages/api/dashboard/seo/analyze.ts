import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return Response.json({ success: false, message: 'يجب تسجيل الدخول' }, { status: 401 });
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') return Response.json({ success: false, message: 'بيانات غير صحيحة' }, { status: 400 });
	const response = await apiRawFetch('/dashboard/seo/analyze', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	return new Response(await response.text(), {
		status: response.status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
	});
};
