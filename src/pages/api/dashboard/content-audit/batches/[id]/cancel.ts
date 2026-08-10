import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../../lib/api';
import { safeRedirectPath } from '../../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/content-audit?tab=ai')}`);
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/content-audit?tab=ai');
	const separator = redirectTo.includes('?') ? '&' : '?';
	const res = await apiRawFetch(`/dashboard/content-audit/ai/batch-jobs/${params.id}/cancel`, { method: 'POST', countryId: locals.countryId, cookieHeader: `token=${token}` });
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'تعذّر إلغاء الدفعة')}`);
	return redirect(`${redirectTo}${separator}success=batch_cancelled`);
};
