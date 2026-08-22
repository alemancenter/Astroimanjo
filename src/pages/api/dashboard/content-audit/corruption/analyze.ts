import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	const fallback = '/dashboard/content-audit/corruption';
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent(fallback)}`);

	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), fallback);
	const type = String(form.get('type') || '').trim().toLowerCase();
	const id = String(form.get('id') || '').trim();
	const country = String(form.get('country') || 'jo').trim().toLowerCase();
	const separator = redirectTo.includes('?') ? '&' : '?';

	if (!['article', 'post'].includes(type) || !/^\d+$/.test(id) || !['jo', 'sa', 'eg', 'ps'].includes(country)) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent('بيانات عنصر الفساد غير صالحة')}`);
	}

	const res = await apiRawFetch(`/dashboard/content-audit/corruption/${type}/${id}/analyze`, {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		params: { country },
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || !json?.success) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'تعذّر تشغيل تدقيق AI')}`);
	}
	return redirect(`${redirectTo}${separator}success=ai_started`);
};
