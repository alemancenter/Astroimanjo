import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';
import { safeRedirectPath } from '../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/sitemap')}`);

	const form = await request.formData();
	const database = String(form.get('database') || 'jo');
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/sitemap');
	const separator = redirectTo.includes('?') ? '&' : '?';

	const res = await apiRawFetch('/dashboard/sitemap/generate', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ database }),
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || !json?.success) {
		return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'فشل توليد خريطة الموقع')}`);
	}
	return redirect(`${redirectTo}${separator}success=generated`);
};
