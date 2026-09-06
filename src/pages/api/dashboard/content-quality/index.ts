import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// The backend caches the heavy scan per country for 2 minutes, so this proxy
// stays a thin passthrough — filtering/paging never re-runs the scan.
export const GET: APIRoute = async ({ url, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return Response.json({ success: false, message: 'يجب تسجيل الدخول' }, { status: 401 });

	const params: Record<string, string> = {};
	for (const key of ['type', 'status', 'q', 'page', 'per_page', 'country']) {
		const value = url.searchParams.get(key);
		if (value) params[key] = value;
	}

	const response = await apiRawFetch('/dashboard/content-quality', {
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		params,
		timeoutMs: 65_000,
	});
	return new Response(await response.text(), {
		status: response.status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
	});
};
