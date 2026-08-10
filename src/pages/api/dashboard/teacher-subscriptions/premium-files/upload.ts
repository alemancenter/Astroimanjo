import type { APIRoute } from 'astro';
import { apiRawFetch, UPLOAD_TIMEOUT_MS } from '../../../../../lib/api';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/teacher-subscriptions/premium-files')}`);

	const incoming = await request.formData();
	const forward = new FormData();
	for (const key of ['country', 'title', 'description', 'grade_level', 'grade_name', 'subject_id', 'subject_name', 'semester_id', 'semester_name', 'category', 'file_type']) {
		const value = incoming.get(key);
		if (value !== null && value !== '') forward.set(key, value as string);
	}
	const file = incoming.get('file');
	if (file instanceof File && file.size > 0) forward.set('file', file);

	if (!forward.get('file') || !forward.get('subject_name')) {
		return redirect(`/dashboard/teacher-subscriptions/premium-files?error=${encodeURIComponent('يرجى رفع ملف وتحديد المادة')}`);
	}

	const res = await apiRawFetch('/dashboard/teacher-subscriptions/premium-files/upload', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		body: forward,
		timeoutMs: UPLOAD_TIMEOUT_MS,
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`/dashboard/teacher-subscriptions/premium-files?error=${encodeURIComponent(json?.message || 'تعذّر رفع الملف')}`);
	}
	return redirect('/dashboard/teacher-subscriptions/premium-files?success=1');
};
