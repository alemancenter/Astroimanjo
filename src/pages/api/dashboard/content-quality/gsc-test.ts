import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// One live URL Inspection call — verifies the service account + property wiring.
export const GET: APIRoute = async ({ url, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return Response.json({ success: false, message: 'يجب تسجيل الدخول' }, { status: 401 });
	const cc = (url.searchParams.get('country_code') || '').trim();
	const target = (url.searchParams.get('url') || '').trim();
	if (!cc || !target) return Response.json({ success: false, message: 'country_code وurl مطلوبان' }, { status: 400 });

	try {
		const res = await apiRawFetch(`/dashboard/gsc/test?country_code=${encodeURIComponent(cc)}&url=${encodeURIComponent(target)}`, {
			countryId: locals.countryId,
			cookieHeader: `token=${token}`,
			timeoutMs: 35_000,
		});
		return new Response(await res.text(), {
			status: res.status,
			headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
		});
	} catch (err) {
		const timedOut = err instanceof Error && err.name === 'TimeoutError';
		return Response.json(
			{ success: false, message: timedOut ? 'انتهت مهلة الاتصال بـ Google.' : 'تعذّر الاتصال بخدمة الفحص.' },
			{ status: timedOut ? 504 : 502 },
		);
	}
};
