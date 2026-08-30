import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/seo')}`);
	const response = await apiRawFetch('/dashboard/seo/audits', { method: 'POST', countryId: locals.countryId, cookieHeader: `token=${token}`, headers: { 'Content-Type': 'application/json' }, body: '{}' });
	const json: any = await response.json().catch(() => null);
	if (!response.ok || !json?.success) return redirect(`/dashboard/seo?error=${encodeURIComponent(json?.message || 'تعذّر بدء التدقيق')}`);
	return redirect(`/dashboard/seo/audits/${json.data?.id || ''}?success=started`);
};
