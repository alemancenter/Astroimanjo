import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// Draft-time SEO assist — suggests internal taxonomy keywords directly from
// unsaved editor text (title + content), no article/post id required. These
// are first-party site taxonomy (internal search/related-content), not the
// HTML meta-keywords tag Google Search ignores for ranking — see
// back/docs/reports/CONTENT_QUALITY_GOVERNANCE_CENTER_PLAN.md §0.3/§0.4.
export const POST: APIRoute = async ({ request, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response(JSON.stringify({ success: false, message: 'يجب تسجيل الدخول' }), { status: 401 });

	const body = await request.json().catch(() => null);
	if (!body?.title && !body?.content) {
		return new Response(JSON.stringify({ success: false, message: 'أدخل عنوانًا أو محتوى أولًا' }), { status: 400 });
	}

	const res = await apiRawFetch('/dashboard/ai/suggest-keywords', {
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
