import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

function addNotice(path: string, key: 'success' | 'error', value: string): string {
	const url = new URL(path, 'http://localhost');
	url.searchParams.set(key, value);
	return `${url.pathname}${url.search}`;
}

export const POST: APIRoute = async ({ request, cookies, locals, redirect, cache }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/roles')}`);

	const form = await request.formData();
	const id = String(form.get('id') || '');
	const isEdit = Boolean(id);
	const redirectTo = isEdit ? `/dashboard/roles/${id}/edit` : '/dashboard/roles';
	const payload = {
		name: String(form.get('name') || '').trim(),
		permissions: form.getAll('permissions').map((value) => Number(value)).filter(Number.isFinite),
	};

	if (payload.name.length < 2 || payload.name.length > 125) {
		return redirect(addNotice(redirectTo, 'error', 'يجب أن يتكون اسم الدور من حرفين إلى 125 حرفًا.'));
	}

	const response = await apiRawFetch(isEdit ? `/dashboard/roles/${id}` : '/dashboard/roles', {
		method: isEdit ? 'PUT' : 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const json: any = await response.json().catch(() => null);
	if (!response.ok || !json?.success) {
		return redirect(addNotice(redirectTo, 'error', json?.message || 'تعذّر حفظ الدور.'));
	}

	await cache.invalidate({ tags: ['roles', 'permissions', 'users', 'dashboard'] });
	return redirect(addNotice(redirectTo, 'success', isEdit ? 'تم تحديث الدور بنجاح.' : 'تم إنشاء الدور بنجاح.'));
};
