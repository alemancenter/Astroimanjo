import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { safeRedirectPath } from '../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/content-audit')}`);
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/content-audit');
	const separator = redirectTo.includes('?') ? '&' : '?';
	const res = await apiRawFetch('/dashboard/content-audit/run', { method: 'POST', countryId: locals.countryId, cookieHeader: `token=${token}` });
	const json: any = await res.json().catch(() => null);
	if (!res.ok || !json?.success) return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'تعذّر بدء التدقيق')}`);
	return redirect(`${redirectTo}${separator}success=audit_started`);
};
