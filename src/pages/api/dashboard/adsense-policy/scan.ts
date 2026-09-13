import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

// The backend scan is O(n^2) in the article+post library size and can legitimately take tens
// of seconds — well past DEFAULT_TIMEOUT_MS (10s), so this needs its own longer budget matching
// the backend handler's own 55s context timeout.
const SCAN_TIMEOUT_MS = 60_000;

export const POST: APIRoute = async ({ cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response(JSON.stringify({ success: false, message: 'يجب تسجيل الدخول' }), { status: 401 });

	const res = await apiRawFetch('/dashboard/adsense-policy/scan', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		timeoutMs: SCAN_TIMEOUT_MS,
	});
	const json: any = await res.json().catch(() => null);

	return new Response(JSON.stringify(json ?? { success: false, message: 'تعذّر تنفيذ الفحص' }), {
		status: res.status,
		headers: { 'Content-Type': 'application/json' },
	});
};
