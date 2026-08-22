import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

const allowedDecisions = new Set(['unclassified', 'keep', 'improve', 'noindex', 'merge_301']);

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	const fallback = '/dashboard/content-audit/inventory';
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent(fallback)}`);

	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), fallback);
	const separator = redirectTo.includes('?') ? '&' : '?';
	const type = String(form.get('type') || '').trim().toLowerCase();
	const id = String(form.get('id') || '').trim();
	const country = String(form.get('country') || 'jo').trim().toLowerCase();
	const decision = String(form.get('decision') || '').trim().toLowerCase();
	const notes = String(form.get('notes') || '').trim();
	const targetContentType = String(form.get('target_content_type') || '').trim().toLowerCase();
	const targetContentID = String(form.get('target_content_id') || '').trim();

	if (!['article', 'post'].includes(type) || !/^\d+$/.test(id) || !['jo', 'sa', 'eg', 'ps'].includes(country) || !allowedDecisions.has(decision)) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent('بيانات التصنيف غير صالحة')}`);
	}
	if (decision === 'merge_301' && (!['article', 'post'].includes(targetContentType) || !/^\d+$/.test(targetContentID))) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent('قرار MERGE/301 يحتاج صفحة هدف صحيحة')}`);
	}

	const payload = {
		decision,
		notes,
		target_content_type: decision === 'merge_301' ? targetContentType : '',
		target_content_id: decision === 'merge_301' ? Number(targetContentID) : 0,
	};
	const res = await apiRawFetch(`/dashboard/content-audit/inventory/${type}/${id}/classify`, {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		params: { country },
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'تعذّر حفظ التصنيف التحريري')}`);
	}
	return redirect(`${redirectTo}${separator}success=classified&seo_effect=${encodeURIComponent(json?.data?.seo_effect || 'none')}`);
};
