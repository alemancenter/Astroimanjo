import type { APIRoute } from 'astro';
import { apiRawFetch, UPLOAD_TIMEOUT_MS } from '../../../lib/api';

export const prerender = false;

const SOCIAL_KEYS = ['facebook', 'twitter', 'linkedin', 'instagram', 'github'] as const;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) {
		return redirect('/login?redirect_to=%2Faccount');
	}

	const form = await request.formData();
	const photo = form.get('profile_photo');
	const hasPhoto = photo instanceof File && photo.size > 0;

	// Backend accepts either a JSON body or multipart (services.UpdateProfileInput,
	// handlers/auth/handler.go UpdateProfile) — multipart is only needed when a new
	// profile photo is attached, since apiRawFetch can't JSON-encode a File.
	let body: BodyInit;
	let extraHeaders: Record<string, string> | undefined;

	if (hasPhoto) {
		const upstream = new FormData();
		upstream.set('name', String(form.get('name') || '').trim());
		upstream.set('phone', String(form.get('phone') || '').trim());
		upstream.set('job_title', String(form.get('job_title') || '').trim());
		upstream.set('gender', String(form.get('gender') || ''));
		upstream.set('country', String(form.get('country') || '').trim());
		upstream.set('bio', String(form.get('bio') || '').trim());
		for (const key of SOCIAL_KEYS) {
			upstream.set(`social_links[${key}]`, String(form.get(`social_links[${key}]`) || '').trim());
		}
		upstream.set('profile_photo', photo as File);
		body = upstream;
	} else {
		const socialLinks = Object.fromEntries(
			SOCIAL_KEYS.map((key) => [key, String(form.get(`social_links[${key}]`) || '').trim()])
		);
		body = JSON.stringify({
			name: String(form.get('name') || '').trim(),
			phone: String(form.get('phone') || '').trim(),
			job_title: String(form.get('job_title') || '').trim(),
			gender: String(form.get('gender') || ''),
			country: String(form.get('country') || '').trim(),
			bio: String(form.get('bio') || '').trim(),
			social_links: JSON.stringify(socialLinks),
		});
		extraHeaders = { 'Content-Type': 'application/json' };
	}

	const res = await apiRawFetch('/auth/profile', {
		method: 'PUT',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: extraHeaders,
		body,
		timeoutMs: hasPhoto ? UPLOAD_TIMEOUT_MS : undefined,
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`/account?error=${encodeURIComponent(json?.message || 'تعذّر حفظ التغييرات')}`);
	}
	return redirect('/account?saved=1');
};
