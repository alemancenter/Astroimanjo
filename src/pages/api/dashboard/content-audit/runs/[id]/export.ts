import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../../lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ params, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/content-audit/scan')}`);
	const res = await apiRawFetch(`/dashboard/content-audit/runs/${params.id}/export`, { countryId: locals.countryId, cookieHeader: `token=${token}` });
	return new Response(await res.arrayBuffer(), { status: res.status, headers: {
		'Content-Type': res.headers.get('content-type') || 'text/csv; charset=utf-8',
		'Content-Disposition': res.headers.get('content-disposition') || `attachment; filename="content-audit-${params.id}.csv"`,
	} });
};
