import type { APIRoute } from 'astro';
import { apiRawFetch } from '../../../../../lib/api';
import { safeRedirectPath } from '../../../../../lib/safe-redirect';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
	const token = cookies.get('token')?.value;
	if (!token) return redirect(`/login?redirect_to=${encodeURIComponent('/dashboard/chatbot?tab=sessions')}`);
	const form = await request.formData();
	const ids = form.getAll('ids').map(Number).filter((id) => Number.isInteger(id) && id > 0);
	const redirectTo = safeRedirectPath(String(form.get('redirect_to') || ''), '/dashboard/chatbot?tab=sessions');
	const separator = redirectTo.includes('?') ? '&' : '?';
	if (!ids.length) return redirect(`${redirectTo}${separator}error=${encodeURIComponent('حدد محادثة واحدة على الأقل للتصدير')}`);

	const res = await apiRawFetch('/dashboard/chatbot/sessions/export', {
		method: 'POST', countryId: locals.countryId, cookieHeader: `token=${token}`,
		headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
	});
	const json: any = await res.json().catch(() => null);
	if (!res.ok || json?.success === false) return redirect(`${redirectTo}${separator}error=${encodeURIComponent(json?.message || 'تعذّر تصدير المحادثات')}`);

	return new Response(JSON.stringify(json?.data?.conversations ?? [], null, 2), {
		status: 200,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="chatbot-training-${new Date().toISOString().slice(0, 10)}.json"`,
		},
	});
};
