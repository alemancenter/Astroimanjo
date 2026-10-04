import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';

export const prerender = false;

export const POST: APIRoute = async ({ params, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response(JSON.stringify({ success: false, message: 'يجب تسجيل الدخول' }), { status: 401 });
	const id = params.id;
	if (!id) return new Response(JSON.stringify({ success: false, message: 'معرف غير صحيح' }), { status: 400 });

	const res = await apiRawFetch(`/dashboard/human-review/${encodeURIComponent(id)}/approve`, {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
	});
	const json: any = await res.json().catch(() => null);

	return new Response(JSON.stringify(json ?? { success: false, message: 'تعذّر اعتماد التعديل' }), {
		status: res.status,
		headers: { 'Content-Type': 'application/json' },
	});
};
