import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// The backend deliberately caps a fix at fewer attempts than fresh generation (policyFixMinAttempts/
// MaxAttempts in policy_fix_service.go: 2-3, not 3-4) — a fix starts from real existing content so
// it rarely needs as many retries, and this budget exists specifically to keep the whole thing
// fast. Worst case: up to 3 content-fix attempts (~30s each, ~90s) plus the SEO/meta pass (up to
// 3 attempts, ~20s each, ~60s) — but that SEO pass only runs when the title or meta description
// was itself flagged, not on every content fix, so the common case (thin/medium content alone) is
// far below this ceiling in practice. This must stay above the true worst case (~150s) or a
// legitimately-still-working fix gets aborted here and reported as a failure even though the
// backend would have returned a good draft moments later.
const FIX_TIMEOUT_MS = 170_000;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response(JSON.stringify({ success: false, message: 'يجب تسجيل الدخول' }), { status: 401 });

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return new Response(JSON.stringify({ success: false, message: 'بيانات غير صحيحة' }), { status: 400 });
	}

	const res = await apiRawFetch('/dashboard/content-gen/fix', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
		timeoutMs: FIX_TIMEOUT_MS,
	});
	const json: any = await res.json().catch(() => null);

	return new Response(JSON.stringify(json ?? { success: false, message: 'تعذّر إصلاح المحتوى' }), {
		status: res.status,
		headers: { 'Content-Type': 'application/json' },
	});
};
