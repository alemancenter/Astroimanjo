import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';

export const prerender = false;

function notice(key: 'success' | 'error', value: string): string {
	const url = new URL('/dashboard/permissions', 'http://localhost');
	url.searchParams.set(key, value);
	return `${url.pathname}${url.search}`;
}

export const POST: APIRoute = async ({ params, cookies, locals, redirect, cache }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/permissions')}`);
	const response = await apiRawFetch(`/dashboard/permissions/${params.id}`, {
		method: 'DELETE', countryId: locals.countryId, cookieHeader: `token=${token}`,
	});
	const json: any = await response.json().catch(() => null);
	if (!response.ok || json?.success === false) return redirect(notice('error', json?.message || 'تعذّر حذف الصلاحية.'));
	await cache.invalidate({ tags: ['permissions', 'roles', 'users', 'dashboard'] });
	return redirect(notice('success', 'تم حذف الصلاحية بنجاح.'));
};
