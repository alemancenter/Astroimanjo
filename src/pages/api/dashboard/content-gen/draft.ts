import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// A single Together AI call plus a same-project duplicate check — well under
// DEFAULT_TIMEOUT_MS's usual budget, but generation latency varies, so give it real headroom.
const DRAFT_TIMEOUT_MS = 45_000;

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
