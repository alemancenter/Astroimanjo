import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// One live, synchronous URL Inspection call — lets an admin verify the
// service account + property are wired correctly straight from the
// dashboard, without waiting on a background sync or reading server logs.
export const GET: APIRoute = async ({ url, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response(JSON.stringify({ success: false, message: 'يجب تسجيل الدخول' }), { status: 401 });

	const countryCode = url.searchParams.get('country_code') || '';
	const testUrl = url.searchParams.get('url') || '';
	if (!countryCode || !testUrl) {
		return new Response(JSON.stringify({ success: false, message: 'country_code وurl مطلوبان' }), { status: 400 });
	}

	const res = await apiRawFetch('/dashboard/gsc/test', {
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		params: { country_code: countryCode, url: testUrl },
		timeoutMs: 30000,
	});
	const json: any = await res.json().catch(() => null);

	return new Response(JSON.stringify(json), {
		status: res.status,
		headers: { 'Content-Type': 'application/json' },
	});
};
