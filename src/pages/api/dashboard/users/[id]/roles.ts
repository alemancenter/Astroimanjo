import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';

export const prerender = false;

function addNotice(path: string, key: 'success' | 'error', value: string): string {
	const url = new URL(path, 'http://localhost');
	url.searchParams.set(key, value);
	return `${url.pathname}${url.search}`;
}

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect, cache }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/users')}`);
	const target = `/dashboard/users/${params.id}/edit`;

	const form = await request.formData();
	const payload = {
		roles: form.getAll('roles').map((value) => Number(value)),
		permissions: form.getAll('permissions').map((value) => Number(value)),
	};

	const response = await apiRawFetch(`/dashboard/users/${params.id}/roles-permissions`, {
		method: 'PUT',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const json: any = await response.json().catch(() => null);

	if (!response.ok || !json?.success) {
		return redirect(addNotice(target, 'error', json?.message || 'تعذّر تحديث الأدوار والصلاحيات.'));
	}
	await cache.invalidate({ tags: ['users', 'roles', 'permissions', 'dashboard'] });
	return redirect(addNotice(target, 'success', 'تم تحديث الأدوار والصلاحيات بنجاح.'));
};
