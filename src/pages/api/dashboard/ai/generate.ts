import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// Starts an async AI content-generation job (backend: services.AIService via
// GenerateSEOArticleWithContext) and hands back the job_id for polling — see status/[id].ts.
export const POST: APIRoute = async ({ request, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response(JSON.stringify({ success: false, message: 'يجب تسجيل الدخول' }), { status: 401 });

	const body = await request.json().catch(() => null);
	if (!body?.title) {
		return new Response(JSON.stringify({ success: false, message: 'العنوان مطلوب' }), { status: 400 });
	}

	const res = await apiRawFetch('/dashboard/ai/generate', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	const json: any = await res.json().catch(() => null);

	return new Response(JSON.stringify(json), {
		status: res.status,
		headers: { 'Content-Type': 'application/json' },
	});
};
