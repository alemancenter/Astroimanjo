import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../lib/api';

export const prerender = false;

function noticeUrl(path: string, key: 'success' | 'error', message: string): string {
	const url = new URL(path, 'http://localhost');
	url.searchParams.set(key, message);
	return `${url.pathname}${url.search}`;
}

export const POST: APIRoute = async ({ request, cookies, locals, redirect, cache }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/categories')}`);

	const form = await request.formData();
	const id = String(form.get('id') || '');
	const isEdit = Boolean(id);
	const isActiveValue = String(form.get('is_active') ?? 'true').toLowerCase();
	const payload = {
		name: String(form.get('name') || '').trim(),
		slug: String(form.get('slug') || '').trim(),
		icon: String(form.get('icon') || '').trim(),
		parent_id: form.get('parent_id') ? Number(form.get('parent_id')) : null,
		is_active: ['true', '1', 'on'].includes(isActiveValue),
	};

	if (!payload.name) {
		const back = isEdit ? `/dashboard/categories/${id}/edit` : '/dashboard/categories/new';
		return redirect(noticeUrl(back, 'error', 'يرجى إدخال اسم التصنيف'));
	}

	const saveResponse = await apiRawFetch(isEdit ? `/dashboard/categories/${id}` : '/dashboard/categories', {
		method: isEdit ? 'PUT' : 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const saved: any = await saveResponse.json().catch(() => null);

	if (!saveResponse.ok || !saved?.success) {
		const back = isEdit ? `/dashboard/categories/${id}/edit` : '/dashboard/categories/new';
		return redirect(noticeUrl(back, 'error', saved?.message || 'تعذّر حفظ التصنيف'));
	}

	const savedId = String(saved?.data?.id || id);
	const image = form.get('image');
	const iconImage = form.get('icon_image');
	const hasImage = image instanceof File && image.size > 0;
	const hasIconImage = iconImage instanceof File && iconImage.size > 0;

	if (savedId && (hasImage || hasIconImage)) {
		const images = new FormData();
		if (hasImage) images.set('image', image);
		if (hasIconImage) images.set('icon_image', iconImage);

		const imageResponse = await apiRawFetch(`/dashboard/categories/${savedId}/images`, {
			method: 'POST',
			countryId: locals.countryId,
			cookieHeader: `token=${token}`,
			body: images,
		});
		const imageResult: any = await imageResponse.json().catch(() => null);
		if (!imageResponse.ok || !imageResult?.success) {
			await cache.invalidate({ tags: ['categories', 'posts'] });
			return redirect(noticeUrl(`/dashboard/categories/${savedId}/edit`, 'error', `تم حفظ التصنيف، لكن تعذّر رفع الصور: ${imageResult?.message || 'خطأ غير معروف'}`));
		}
	}

	await cache.invalidate({ tags: ['categories', 'posts'] });
	return redirect(noticeUrl('/dashboard/categories', 'success', isEdit ? 'تم تحديث التصنيف بنجاح' : 'تم إنشاء التصنيف بنجاح'));
};
