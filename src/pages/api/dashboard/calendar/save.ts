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
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/calendar')}`);

	const form = await request.formData();
	const id = String(form.get('id') || '');
	const isEdit = !!id;
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/calendar');

	const payload = {
		title: String(form.get('title') || '').trim(),
		description: String(form.get('description') || '').trim(),
		event_date: String(form.get('event_date') || ''),
	};

	if (payload.title.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(payload.event_date)) {
		return redirect(addNotice(redirectTo, 'error', 'يرجى إدخال عنوان صحيح وتحديد تاريخ الحدث'));
	}

	const res = await apiRawFetch(isEdit ? `/dashboard/calendar/events/${id}` : '/dashboard/calendar/events', {
		method: isEdit ? 'PUT' : 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(addNotice(redirectTo, 'error', json?.message || 'تعذّر حفظ الحدث'));
	}
	await cache.invalidate({ tags: ['calendar', 'home'] });
	return redirect(addNotice(redirectTo, 'success', isEdit ? 'تم تحديث الحدث' : 'تمت إضافة الحدث'));
};
