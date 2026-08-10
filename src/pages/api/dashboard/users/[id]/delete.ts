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
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/users');
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/users')}`);

	const response = await apiRawFetch(`/dashboard/users/${params.id}`, {
		method: 'DELETE',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
	});
	const result: any = await response.json().catch(() => null);
	if (!response.ok || result?.success === false) {
		return redirect(addNotice(redirectTo, 'error', result?.message || 'تعذّر حذف المستخدم'));
	}

	await cache.invalidate({ tags: ['users', 'dashboard', 'security'] });
	return redirect(addNotice(redirectTo, 'success', 'تم حذف المستخدم'));
};
