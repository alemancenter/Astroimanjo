import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, cookies, locals, redirect, cache }) => {
	const { id } = params;
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/categories')}`);

	const incoming = await request.formData();
	const forward = new FormData();
	const image = incoming.get('image');
	const iconImage = incoming.get('icon_image');
	if (image instanceof File && image.size > 0) forward.set('image', image);
	if (iconImage instanceof File && iconImage.size > 0) forward.set('icon_image', iconImage);

	if (![...forward.keys()].length) {
		return redirect(`/dashboard/categories/${id}/edit?error=${encodeURIComponent('يرجى اختيار صورة للرفع')}`);
	}

	const res = await apiRawFetch(`/dashboard/categories/${id}/images`, {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		body: forward,
	});
	const json: any = await res.json().catch(() => null);

	if (!res.ok || !json?.success) {
		return redirect(`/dashboard/categories/${id}/edit?error=${encodeURIComponent(json?.message || 'تعذّر رفع الصورة')}`);
	}
	await cache.invalidate({ tags: ['categories', 'posts'] });
	return redirect(`/dashboard/categories/${id}/edit?success=1`);
};
