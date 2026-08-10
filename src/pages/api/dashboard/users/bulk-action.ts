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
	const operation = String(form.get('operation') || '');
	const ids = [...new Set(form.getAll('ids').map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
	if (!ids.length || !['active', 'inactive', 'banned', 'delete'].includes(operation)) {
		return redirect(addNotice(redirectTo, 'error', 'يرجى تحديد مستخدم واحد على الأقل واختيار العملية'));
	}

	const response = await apiRawFetch(operation === 'delete' ? '/dashboard/users/bulk-delete' : '/dashboard/users/update-status', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(operation === 'delete' ? { ids } : { ids, status: operation }),
	});
	const result: any = await response.json().catch(() => null);
	if (!response.ok || !result?.success) {
		return redirect(addNotice(redirectTo, 'error', result?.message || 'تعذّر تنفيذ العملية على المستخدمين'));
	}

	await cache.invalidate({ tags: ['users', 'dashboard', 'security'] });
	const message = operation === 'delete' ? `تم حذف ${ids.length} مستخدم` : `تم تحديث حالة ${ids.length} مستخدم`;
	return redirect(addNotice(redirectTo, 'success', message));
};
