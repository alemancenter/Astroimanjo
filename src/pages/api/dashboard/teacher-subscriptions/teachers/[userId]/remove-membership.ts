import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../../lib/api';

export const prerender = false;

export const POST: APIRoute = async ({ params, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/teacher-subscriptions/teachers')}`);

	const res = await apiRawFetch(`/dashboard/teacher-subscriptions/teachers/${params.userId}/remove-membership`, {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({}),
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || !json?.success) {
		return redirect(`/dashboard/teacher-subscriptions/teachers?error=${encodeURIComponent(json?.message || 'فشل إزالة العضوية')}`);
	}
	return redirect('/dashboard/teacher-subscriptions/teachers?success=1');
};
