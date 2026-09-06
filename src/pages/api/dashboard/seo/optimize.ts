import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// The backend runs one AI model call (up to ~90s incl. a fallback). apiRawFetch's
// 10s default would abort it, so allow the full window here.
const OPTIMIZE_TIMEOUT_MS = 120_000;

const json = (body: Record<string, unknown>, status: number) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
	});

export const POST: APIRoute = async ({ request, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return json({ success: false, message: 'يجب تسجيل الدخول' }, 401);
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') return json({ success: false, message: 'بيانات غير صحيحة' }, 400);

	try {
		// The country comes from the server session, never the client payload.
		const response = await apiRawFetch('/dashboard/seo/optimize', {
			method: 'POST',
			countryId: locals.countryId,
			cookieHeader: `token=${token}`,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...body, country_code: locals.countryCode }),
			timeoutMs: OPTIMIZE_TIMEOUT_MS,
		});
		return new Response(await response.text(), {
			status: response.status,
			headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
		});
	} catch (err) {
		// Always answer with JSON — the panel's fetch() calls response.json() unconditionally.
		const timedOut = err instanceof Error && err.name === 'TimeoutError';
		return json(
			{ success: false, message: timedOut ? 'استغرق التحسين وقتًا أطول من المتوقع، حاول مرة أخرى.' : 'تعذّر الاتصال بخدمة التحسين حاليًا.' },
			timedOut ? 504 : 502,
		);
	}
};
