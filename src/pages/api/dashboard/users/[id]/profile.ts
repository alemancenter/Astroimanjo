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
	const target = `/dashboard/users/${params.id}/edit`;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent(target)}`);

	const form = await request.formData();
	const name = String(form.get('name') || '').trim();
	const gender = String(form.get('gender') || '');
	const status = String(form.get('status') || '');
	const password = String(form.get('password') || '');

	if (name.length < 2 || (gender && !['male', 'female', 'other'].includes(gender)) || (status && !['active', 'inactive', 'banned'].includes(status))) {
		return redirect(addNotice(target, 'error', 'تحقق من بيانات الحساب المدخلة.'));
	}
	if (password && password.length < 8) {
		return redirect(addNotice(target, 'error', 'يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف.'));
	}

	const payload: Record<string, string> = {
		name,
		phone: String(form.get('phone') || '').trim(),
		job_title: String(form.get('job_title') || '').trim(),
		gender,
		country: String(form.get('country') || '').trim(),
	};
	if (status) payload.status = status;
	if (password) payload.password = password;

	const response = await apiRawFetch(`/dashboard/users/${params.id}`, {
		method: 'PUT',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const json: any = await response.json().catch(() => null);
	if (!response.ok || !json?.success) {
		return redirect(addNotice(target, 'error', json?.message || 'تعذّر تحديث بيانات المستخدم.'));
	}

	await cache.invalidate({ tags: ['users', 'dashboard', 'security'] });
	return redirect(addNotice(target, 'success', 'تم تحديث بيانات المستخدم بنجاح.'));
};
