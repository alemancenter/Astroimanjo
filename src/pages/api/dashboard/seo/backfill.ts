import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// Deterministic (no AI, no external calls) — just AnalyzeSEO run once per never-configured
// article/post plus one DB read and one DB write each — but a large library means this can
// still take a while in one pass when there are many never-configured items, longer than the
// 10s default. Comfortably under cmd/server/main.go's 240s WriteTimeout.
const BACKFILL_TIMEOUT_MS = 180_000;

export const POST: APIRoute = async ({ cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response(JSON.stringify({ success: false, message: 'يجب تسجيل الدخول' }), { status: 401 });

	const res = await apiRawFetch('/dashboard/seo/backfill', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		timeoutMs: BACKFILL_TIMEOUT_MS,
	});
	const json: any = await res.json().catch(() => null);

	return new Response(JSON.stringify(json ?? { success: false, message: 'تعذّر حساب تقييمات SEO' }), {
		status: res.status,
		headers: { 'Content-Type': 'application/json' },
	});
};
