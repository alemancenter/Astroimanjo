import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// Same underlying AI call as the old content-gen/fix.ts (services.ContentDraftService.
// FixPolicyContent), so it needs the same generous budget — see that file for the full
// breakdown. The result is now queued for human review instead of handed back as a draft the
// admin applies themselves from the edit page.
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
