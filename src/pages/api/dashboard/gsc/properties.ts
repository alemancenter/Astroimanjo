import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// Lists the configured country -> Search Console property (site_url) map. See
// back/docs/reports/CONTENT_QUALITY_GOVERNANCE_CENTER_PLAN.md §4.
export const GET: APIRoute = async ({ cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response(JSON.stringify({ success: false, message: 'يجب تسجيل الدخول' }), { status: 401 });

	const res = await apiRawFetch('/dashboard/gsc/properties', {
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
	});
	const json: any = await res.json().catch(() => null);

	return new Response(JSON.stringify(json), {
		status: res.status,
		headers: { 'Content-Type': 'application/json' },
	});
};
