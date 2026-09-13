import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// Compatibility route: create suggestions for individual review, never apply them.
export const POST: APIRoute = async ({ cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect('/login?redirect_to=/dashboard/content-quality');
	const back = '/dashboard/content-audit/ai-operations';

	try {
		const res = await apiRawFetch('/dashboard/content-audit/ai/batch-jobs', {
			method: 'POST',
			countryId: locals.countryId,
			cookieHeader: `token=${token}`,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				country_code: locals.countryCode,
				mode: 'fix_preview',
				preset: 'meta_description',
				source: 'adsense_readiness',
				model_strategy: 'balanced',
				limit: 100,
			}),
			timeoutMs: 25_000,
		});
		const json: any = await res.json().catch(() => null);
		if (!res.ok || json?.success === false) {
			return redirect(`${back}?error=${encodeURIComponent(json?.message || 'تعذّر بدء الإصلاح')}`);
		}
		return redirect(`${back}?success=batch_started`);
	} catch {
		return redirect(`${back}?error=${encodeURIComponent('تعذّر الاتصال بخدمة الإصلاح')}`);
	}
};
