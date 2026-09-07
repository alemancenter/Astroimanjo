import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// Full AI quality decision for one item — policy issues (with evidence),
// suggestions, AdSense risk. Used by the AdSense-compliance drawer.
export const GET: APIRoute = async ({ url, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return Response.json({ success: false, message: 'يجب تسجيل الدخول' }, { status: 401 });
	const type = url.searchParams.get('type') === 'post' ? 'post' : 'article';
	const id = Number(url.searchParams.get('id'));
	const cc = (url.searchParams.get('country') || locals.countryCode || 'jo').trim();
	if (!Number.isInteger(id) || id <= 0) return Response.json({ success: false, message: 'معرف غير صالح' }, { status: 400 });

	const res = await apiRawFetch(`/dashboard/content-audit/ai/decision/${type}/${id}`, {
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		params: { country: cc },
		timeoutMs: 15_000,
	});
	return new Response(await res.text(), {
		status: res.status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
	});
};
