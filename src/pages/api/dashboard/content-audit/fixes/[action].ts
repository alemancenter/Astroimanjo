import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/content-audit?tab=ai')}`);
	const action = params.action === 'apply' ? 'apply-fix' : params.action === 'reject' ? 'reject-fix' : '';
	if (!action) return new Response('Not found', { status: 404 });
	const form = await request.formData();
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/content-audit?tab=ai');
	const separator = redirectTo.includes('?') ? '&' : '?';
	const payload = { fix_preview_id: Number(form.get('fix_preview_id') || 0), note: String(form.get('note') || '').trim() };
	const res = await apiRawFetch(`/dashboard/content-audit/ai/${action}`, {
		method: 'POST', countryId: locals.countryId, cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'تعذّر تنفيذ القرار')}`);
	return redirect(`${redirectTo}${separator}success=${action === 'apply-fix' ? 'fix_applied' : 'fix_rejected'}`);
};
