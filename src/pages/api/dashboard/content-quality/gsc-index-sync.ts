import type { APIRoute } from 'astro';
import { apiFetch, apiRawFetch } from '../../../../lib/api';

export const prerender = false;

const SITE = (import.meta.env.PUBLIC_SITE_URL || 'https://imanjo.com').replace(/\/$/, '');

// Sync Google's index status for every published, indexable article/post of the
// current country. Targets are built here (the backend's /gsc/sync expects an
// explicit list) from the content-quality set.
export const POST: APIRoute = async ({ cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect('/login?redirect_to=/dashboard/content-quality?tab=search');
	const back = '/dashboard/content-quality?tab=search';
	const cc = locals.countryCode || 'jo';

	const list = await apiFetch<any>('/dashboard/content-quality', {
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		params: { country: cc, per_page: 500, page: 1 },
	});
	const items: any[] = Array.isArray(list.data?.items) ? list.data.items : [];
	const targets = items
		.filter((it) => it.published && it.indexable)
		.slice(0, 200)
		.map((it) => ({
			content_type: it.type,
			content_id: it.id,
			url: `${SITE}/${cc}/${it.type === 'post' ? 'posts' : 'lesson/articles'}/${it.id}`,
		}));

	if (targets.length === 0) return redirect(`${back}&error=${encodeURIComponent('لا يوجد محتوى منشور قابل للفهرسة')}`);

	try {
		const res = await apiRawFetch('/dashboard/gsc/sync', {
			method: 'POST',
			countryId: locals.countryId,
			cookieHeader: `token=${token}`,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ country_code: cc, targets }),
			timeoutMs: 25_000,
		});
		const json: any = await res.json().catch(() => null);
		return redirect(res.ok ? `${back}&success=index-sync` : `${back}&error=${encodeURIComponent(json?.message || 'تعذّرت مزامنة الفهرسة')}`);
	} catch {
		return redirect(`${back}&error=${encodeURIComponent('تعذّر الاتصال بخدمة المزامنة')}`);
	}
};
