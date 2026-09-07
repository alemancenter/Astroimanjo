import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// "تدقيق شامل بالذكاء" — starts a background batch that runs the AI quality
// audit (analyze_only, creates a decision per item) for every article/post that
// was never audited. Repeatable; each run takes the next batch of up to 500.
export const POST: APIRoute = async ({ cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect('/login?redirect_to=/dashboard/content-quality');
	const back = '/dashboard/content-quality';

	try {
		const res = await apiRawFetch('/dashboard/content-audit/ai/batch-jobs', {
			method: 'POST',
			countryId: locals.countryId,
			cookieHeader: `token=${token}`,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
                country_code: locals.countryCode,
				mode: 'analyze_only',
				preset: 'unaudited',
				source: 'adsense_readiness',
				content_type: 'all',
				model_strategy: 'balanced',
				limit: 500,
			}),
			timeoutMs: 25_000,
		});
		const json: any = await res.json().catch(() => null);
		if (!res.ok || json?.success === false) {
			return redirect(`${back}?error=${encodeURIComponent(json?.message || 'تعذّر بدء التدقيق')}`);
		}
		return redirect(`${back}?success=audit-all`);
	} catch {
		return redirect(`${back}?error=${encodeURIComponent('تعذّر الاتصال بخدمة التدقيق')}`);
	}
};
