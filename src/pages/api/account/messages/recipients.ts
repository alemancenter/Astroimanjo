import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { getCurrentUser } from '../../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return Response.json({ success: false, data: [] }, { status: 401 });
	const query = new URL(request.url).searchParams.get('q')?.trim() || '';
	if (query.length < 2) return Response.json({ success: true, data: [] });

	try {
		const [response, currentUser] = await Promise.all([
			apiRawFetch('/user/search', {
				countryId: locals.countryId,
				cookieHeader: `token=${token}`,
				params: { q: query },
			}),
			getCurrentUser({ cookies, locals }),
		]);
		const json: any = await response.json().catch(() => null);
		if (!response.ok || json?.success === false) {
			return Response.json({ success: false, data: [] }, { status: response.status || 502 });
		}
		const users = (Array.isArray(json?.data) ? json.data : [])
			.filter((user: any) => String(user.id) !== String(currentUser?.id || ''))
			.map((user: any) => ({ id: user.id, name: user.name, email: user.email }));
		return Response.json({ success: true, data: users });
	} catch {
		return Response.json({ success: false, data: [] }, { status: 502 });
	}
};
