import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// The backend retries up to 4 times (cycling through fallback AI models) whenever a draft comes
// back truncated, too short, duplicate, or full of generic filler — each attempt budgets up to
// 30s, so the worst case is ~120s of AI calls plus duplicate-check overhead. This must stay above
// that worst case or a legitimately-still-working retry gets aborted here and reported as a
// failure even though the backend would have returned a good draft moments later.
const DRAFT_TIMEOUT_MS = 150_000;

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
