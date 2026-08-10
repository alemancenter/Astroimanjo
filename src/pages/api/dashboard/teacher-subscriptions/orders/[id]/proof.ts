import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../../lib/api';

export const prerender = false;

// Proof files require the admin's session, so unlike the public signed
// downloads this must be streamed through the BFF rather than redirected —
// a redirect would send the browser to api.alemancenter.com without any
// cookie that domain recognizes.
export const GET: APIRoute = async ({ params, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response('Unauthorized', { status: 401 });

	const res = await apiRawFetch(`/dashboard/teacher-subscriptions/orders/${params.id}/proof`, {
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
	});

	if (!res.ok || !res.body) {
		return new Response('تعذّر جلب إثبات الدفع', { status: res.status || 404 });
	}

	return new Response(res.body, {
		status: 200,
		headers: {
			'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
			'Content-Disposition': res.headers.get('content-disposition') || 'inline',
		},
	});
};
