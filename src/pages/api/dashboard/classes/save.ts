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
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/classes')}`);

	const form = await request.formData();
	const id = String(form.get('id') || '');
	const isEdit = !!id;
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/classes');

	const payload = {
		grade_name: String(form.get('grade_name') || '').trim(),
		grade_level: Number(form.get('grade_level') || 0),
	};

	if (!payload.grade_name || payload.grade_level < 1) {
		return redirect(addNotice(redirectTo, 'error', 'يرجى إدخال اسم الصف وترتيب ظهور صحيح'));
	}

	const res = await apiRawFetch(isEdit ? `/dashboard/school-classes/${id}` : '/dashboard/school-classes', {
		method: isEdit ? 'PUT' : 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(addNotice(redirectTo, 'error', json?.message || 'تعذّر حفظ الصف الدراسي'));
	}
	await cache.invalidate({ tags: ['classes', 'subjects', 'articles'] });
	return redirect(addNotice(redirectTo, 'success', isEdit ? 'تم تحديث بيانات الصف' : 'تم إنشاء الصف الدراسي'));
};
