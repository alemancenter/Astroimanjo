import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

function addNotice(path: string, key: 'success' | 'error', value: string): string {
	const url = new URL(path, 'http://localhost');
	url.searchParams.set(key, value);
	return `${url.pathname}${url.search}`;
}

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect, cache }) => {
	const token = cookies.get('token')?.value;
	const database = String(params.database || '');
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/comments');

	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/comments')}`);

	const ids = [...new Set(form.getAll('ids').map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
	if (!ids.length) return redirect(addNotice(redirectTo, 'error', 'يرجى تحديد تعليق واحد على الأقل'));

	const response = await apiRawFetch(`/dashboard/comments/${database}/bulk-delete`, {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ids }),
	});
	const result: any = await response.json().catch(() => null);

	if (!response.ok || result?.success === false) {
		return redirect(addNotice(redirectTo, 'error', result?.message || 'تعذّر حذف التعليقات المحددة'));
	}

	await cache.invalidate({ tags: ['comments', 'articles', 'posts'] });
	return redirect(addNotice(redirectTo, 'success', `تم حذف ${ids.length} تعليق بنجاح`));
};
