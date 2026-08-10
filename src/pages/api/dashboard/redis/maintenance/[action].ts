import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

const actions: Record<string, { path: string; method: 'POST' | 'DELETE'; body?: (form: FormData) => string; success: string }> = {
	'expire-legacy': { path: '/dashboard/redis/legacy-ip-location/expire', method: 'POST', body: (form) => JSON.stringify({ ttl: Math.max(1, Number.parseInt(String(form.get('ttl') || '604800'), 10) || 604800) }), success: 'تم تعيين مدة صلاحية للمفاتيح القديمة.' },
	'clean-legacy': { path: '/dashboard/redis/legacy-ip-location/clean', method: 'DELETE', success: 'تم تنظيف مفاتيح IP Location القديمة.' },
	'clean-expired': { path: '/dashboard/redis/expired/clean', method: 'DELETE', success: 'تم التحقق من تنظيف المفاتيح المنتهية.' },
};

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/redis?tab=maintenance')}`);
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/redis?tab=maintenance');
	const operation = actions[String(params.action || '')];
	if (!operation) return new Response('Not found', { status: 404 });
	const res = await apiRawFetch(operation.path, {
		method: operation.method, countryId: locals.countryId, cookieHeader: `token=${token}`,
		headers: operation.body ? { 'Content-Type': 'application/json' } : undefined,
		body: operation.body?.(form),
	});
	const json: any = await res.json().catch(() => null);
	const url = new URL(redirectTo, 'http://localhost');
	url.searchParams.set(res.ok && json?.success !== false ? 'success' : 'error', res.ok && json?.success !== false ? operation.success : (json?.message || 'تعذّر تنفيذ عملية الصيانة.'));
	return redirect(`${url.pathname}${url.search}`);
};
