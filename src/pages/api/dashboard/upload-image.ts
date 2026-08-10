import type { APIRoute } from 'astro';
import { apiRawFetch, UPLOAD_TIMEOUT_MS } from '../../../lib/api';

export const prerender = false;

// Used by the article/post rich text editor's image button — uploads to real storage and
// returns a hosted path instead of Quill's default behavior of embedding the image as a
// giant base64 data URI directly in the content HTML.
export const POST: APIRoute = async ({ request, cookies, locals }) => {
	const token = cookies.get('token')?.value;
	if (!token) return new Response(JSON.stringify({ success: false, message: 'يجب تسجيل الدخول' }), { status: 401 });

	const incoming = await request.formData();
	const image = incoming.get('image');
	if (!(image instanceof File) || image.size === 0) {
		return new Response(JSON.stringify({ success: false, message: 'يرجى اختيار صورة' }), { status: 400 });
	}

	const forward = new FormData();
	forward.set('image', image);

	const res = await apiRawFetch('/dashboard/secure/upload-image', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		body: forward,
		timeoutMs: UPLOAD_TIMEOUT_MS,
	});
	const json: any = await res.json().catch(() => null);

	return new Response(JSON.stringify(json), {
		status: res.status,
		headers: { 'Content-Type': 'application/json' },
	});
};
