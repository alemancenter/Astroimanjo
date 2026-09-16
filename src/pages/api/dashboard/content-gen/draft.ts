import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// The backend retries the content generation up to 4 times (cycling fallback AI models, ~30s
// per attempt, ~120s worst case), then runs a second, separate SEO-metadata generation pass of
// up to 3 more attempts (~20s each, ~60s worst case) that keeps retrying until the AnalyzeSEO
// score clears its 85% floor. Worst case across both stages is ~180s; this must stay above that
// or a legitimately-still-working retry gets aborted here and reported as a failure even though
// the backend would have returned a good draft (with or without SEO metadata) moments later.
const DRAFT_TIMEOUT_MS = 220_000;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response(JSON.stringify({ success: false, message: 'يجب تسجيل الدخول' }), { status: 401 });

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return new Response(JSON.stringify({ success: false, message: 'بيانات غير صحيحة' }), { status: 400 });
	}

	const res = await apiRawFetch('/dashboard/content-gen/draft', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
		timeoutMs: DRAFT_TIMEOUT_MS,
	});
	const json: any = await res.json().catch(() => null);

	return new Response(JSON.stringify(json ?? { success: false, message: 'تعذّر توليد المحتوى' }), {
		status: res.status,
		headers: { 'Content-Type': 'application/json' },
	});
};
