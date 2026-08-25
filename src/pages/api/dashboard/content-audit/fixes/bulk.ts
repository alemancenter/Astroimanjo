import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

const redirectWith = (redirectTo: string, params: Record<string, string | number>) => {
	const separator = redirectTo.includes('?') ? '&' : '?';
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) query.set(key, String(value));
	return `${redirectTo}${separator}${query.toString()}`;
};

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/content-audit/ai-operations')}`);

	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/content-audit/ai-operations');
	const action = String(form.get('action') || '').trim().toLowerCase();
	if (!['apply', 'reject'].includes(action)) {
		return redirect(redirectWith(redirectTo, { error: 'اختر قبول المعاينات المحددة أو رفضها.' }));
	}

	let rawIDs: unknown;
	try {
		rawIDs = JSON.parse(String(form.get('fix_preview_ids') || '[]'));
	} catch {
		return redirect(redirectWith(redirectTo, { error: 'قائمة المعاينات المحددة غير صالحة.' }));
	}
	if (!Array.isArray(rawIDs)) {
		return redirect(redirectWith(redirectTo, { error: 'قائمة المعاينات المحددة غير صالحة.' }));
	}
	const ids = [...new Set(rawIDs.map(Number))];
	if (ids.length === 0 || ids.length > 100 || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
		return redirect(redirectWith(redirectTo, { error: 'حدد من 1 إلى 100 معاينة صالحة.' }));
	}

	const res = await apiRawFetch('/dashboard/content-audit/ai/bulk-review', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action,
			fix_preview_ids: ids,
			note: String(form.get('note') || '').trim(),
		}),
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) {
		return redirect(redirectWith(redirectTo, { error: json?.message || 'تعذّر تنفيذ القرار الجماعي.' }));
	}

	const succeeded = Math.max(0, Number(json?.data?.succeeded) || 0);
	const failed = Math.max(0, Number(json?.data?.failed) || 0);
	if (succeeded === 0) {
		const firstFailure = Array.isArray(json?.data?.results)
			? json.data.results.find((item: any) => item?.success === false)?.message
			: '';
		return redirect(redirectWith(redirectTo, { error: firstFailure || 'لم يُنفّذ أي قرار؛ بقيت المعاينات المحددة في الطابور.' }));
	}

	const success = failed > 0
		? 'bulk_review_partial'
		: action === 'apply' ? 'bulk_review_applied' : 'bulk_review_rejected';
	return redirect(redirectWith(redirectTo, { success, bulk_succeeded: succeeded, bulk_failed: failed }));
};
