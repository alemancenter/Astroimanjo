import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

const AUDIT_TIMEOUT_MS = 130_000;

const json = (body: Record<string, unknown>, status: number) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
	});

// "بدء تدقيق الجودة" from the content-quality drawer: runs the AI content-quality
// audit for one item (creates its ContentAIDecision) so ads/index gating can
// finally resolve. The backend self-loads the title/content.
export const POST: APIRoute = async ({ request, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return json({ success: false, message: 'يجب تسجيل الدخول' }, 401);
	const body = await request.json().catch(() => null);
	const type = body?.content_type === 'post' ? 'post' : 'article';
	const id = Number(body?.id);
	if (!Number.isInteger(id) || id <= 0) return json({ success: false, message: 'معرف غير صالح' }, 400);

	try {
		const response = await apiRawFetch(`/dashboard/content-quality/audit/${type}/${id}`, {
			method: 'POST',
			countryId: locals.countryId,
			cookieHeader: `token=${token}`,
			headers: { 'Content-Type': 'application/json' },
			body: '{}',
			timeoutMs: AUDIT_TIMEOUT_MS,
		});
		return new Response(await response.text(), {
			status: response.status,
			headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
		});
	} catch (err) {
		const timedOut = err instanceof Error && err.name === 'TimeoutError';
		return json(
			{ success: false, message: timedOut ? 'استغرق التدقيق وقتًا أطول من المتوقع، حاول مرة أخرى.' : 'تعذّر الاتصال بخدمة التدقيق حاليًا.' },
			timedOut ? 504 : 502,
		);
	}
};
