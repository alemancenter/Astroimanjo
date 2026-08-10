import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

function notice(key: 'success' | 'error', value: string): string {
	const url = new URL('/dashboard/permissions', 'http://localhost');
	url.searchParams.set(key, value);
	return `${url.pathname}${url.search}`;
}

export const POST: APIRoute = async ({ request, cookies, locals, redirect, cache }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/permissions')}`);
	const form = await request.formData();
	const id = String(form.get('id') || '');
	const name = String(form.get('name') || '').trim().toLocaleLowerCase();
	if (name.length < 2 || name.length > 125) return redirect(notice('error', 'يجب أن يتكون اسم الصلاحية من حرفين إلى 125 حرفًا.'));

	const response = await apiRawFetch(id ? `/dashboard/permissions/${id}` : '/dashboard/permissions', {
		method: id ? 'PUT' : 'POST', countryId: locals.countryId, cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
	});
	const json: any = await response.json().catch(() => null);
	if (!response.ok || !json?.success) return redirect(notice('error', json?.message || 'تعذّر حفظ الصلاحية.'));
	await cache.invalidate({ tags: ['permissions', 'roles', 'users', 'dashboard'] });
	return redirect(notice('success', id ? 'تم تحديث الصلاحية بنجاح.' : 'تم إنشاء الصلاحية بنجاح.'));
};
