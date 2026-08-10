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
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/users');
	const payload = {
		name: String(form.get('name') || '').trim(),
		email: String(form.get('email') || '').trim().toLowerCase(),
		password: String(form.get('password') || ''),
		roles: form.getAll('roles').map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0),
	};

	if (payload.name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) || payload.password.length < 8) {
		return redirect(addNotice(redirectTo, 'error', 'يرجى إدخال اسم وبريد صحيحين وكلمة مرور من 8 أحرف على الأقل'));
	}

	const response = await apiRawFetch('/dashboard/users', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const result: any = await response.json().catch(() => null);
	if (!response.ok || !result?.success) {
		return redirect(addNotice(redirectTo, 'error', result?.message || 'تعذّر إنشاء المستخدم'));
	}

	await cache.invalidate({ tags: ['users', 'dashboard'] });
	return redirect(addNotice(redirectTo, 'success', 'تم إنشاء المستخدم'));
};
