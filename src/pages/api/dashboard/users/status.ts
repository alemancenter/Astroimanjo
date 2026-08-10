import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { safeRedirectPath } from '../../../../lib/safe-redirect';

export const prerender = false;

function addNotice(path: string, key: 'success' | 'error', value: string): string {
	const url = new URL(path, 'http://localhost');
	url.searchParams.set(key, value);
	return `${url.pathname}${url.search}`;
}

export const POST: APIRoute = async ({ request, cookies, locals, redirect, cache }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/users')}`);

	const form = await request.formData();
	const id = String(form.get('id') || '');
	const status = String(form.get('status') || '');
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/users');

	if (!id || !['active', 'inactive', 'banned'].includes(status)) {
		return redirect(addNotice(redirectTo, 'error', 'طلب غير صحيح'));
	}

	const res = await apiRawFetch('/dashboard/users/update-status', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ids: [Number(id)], status }),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(addNotice(redirectTo, 'error', json?.message || 'فشل تحديث الحالة'));
	}
	await cache.invalidate({ tags: ['users', 'dashboard', 'security'] });
	return redirect(addNotice(redirectTo, 'success', 'تم تحديث حالة المستخدم'));
};
