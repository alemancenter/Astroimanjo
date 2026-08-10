import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../lib/api';
import { safeRedirectPath } from '../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	const form = await request.formData();
	const commentId = String(form.get('comment_id') || '');
	const emoji = String(form.get('emoji') || '');
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/');

	if (!token) {
		return redirect(`/login?redirect_to=${encodeURIComponent(redirectTo)}`);
	}
	if (!commentId || !emoji) {
		return redirect(`${redirectTo}#comments`);
	}

	await apiRawFetch('/reactions', {
		method: 'POST',
		countryId: locals.countryId,
		cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ comment_id: Number(commentId), emoji }),
	}).catch(() => null);

	return redirect(`${redirectTo}#comments`);
};
