import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// Budget: up to 4 content-fix attempts (policyFixMaxAttempts in policy_fix_service.go, ~30s
// each, ~120s worst case — raised from 3 because a persistent near-duplicate against another
// live item needed the extra retry to reliably differentiate) plus the SEO/meta pass (up to 3
// attempts, ~20s each, ~60s) — ~180s worst case. This must stay above that or a legitimately
// still-working fix gets aborted here and reported as a failure even though the backend would
// have returned a good draft moments later. (cmd/server/main.go's WriteTimeout is 240s, so the
// backend itself isn't the constraint.)
const FIX_TIMEOUT_MS = 200_000;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response(JSON.stringify({ success: false, message: 'يجب تسجيل الدخول' }), { status: 401 });

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return new Response(JSON.stringify({ success: false, message: 'بيانات غير صحيحة' }), { status: 400 });
	}

	const res = await apiRawFetch('/dashboard/human-review/fix', {
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
