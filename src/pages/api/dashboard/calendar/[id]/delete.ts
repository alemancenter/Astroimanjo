import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

function addNotice(path: string, key: 'success' | 'error', value: string): string {
	const url = new URL(path, 'http://localhost');
	url.searchParams.set(key, value);
	return `${url.pathname}${url.search}`;
}

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect, cache }) => {
	const token = cookies.get('token')?.value;
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/calendar');
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/calendar')}`);

	const res = await apiRawFetch(`/dashboard/calendar/events/${params.id}`, {
		method: 'DELETE',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) {
		return redirect(addNotice(redirectTo, 'error', json?.message || 'فشل حذف الحدث'));
	}
	await cache.invalidate({ tags: ['calendar', 'home'] });
	return redirect(addNotice(redirectTo, 'success', 'تم حذف الحدث'));
};
