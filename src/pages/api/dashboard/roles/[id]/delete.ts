import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';

export const prerender = false;

function addNotice(key: 'success' | 'error', value: string): string {
	const url = new URL('/dashboard/roles', 'http://localhost');
	url.searchParams.set(key, value);
	return `${url.pathname}${url.search}`;
}

export const POST: APIRoute = async ({ params, cookies, locals, redirect, cache }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/roles')}`);

	const response = await apiRawFetch(`/dashboard/roles/${params.id}`, {
		method: 'DELETE',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
	});
	const json: any = await response.json().catch(() => null);
	if (!response.ok || json?.success === false) {
		return redirect(addNotice('error', json?.message || 'تعذّر حذف الدور.'));
	}

	await cache.invalidate({ tags: ['roles', 'permissions', 'users', 'dashboard'] });
	return redirect(addNotice('success', 'تم حذف الدور بنجاح.'));
};
