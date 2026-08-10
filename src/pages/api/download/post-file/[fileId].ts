import type { APIRoute } from 'astro';
import { proxyDownload } from '../../../../lib/download-proxy';
import { safeRedirectPath } from '../../../../lib/safe-redirect';

export const prerender = false;

// Mirrors the article-file route: obtain and consume the signed token on the
// server, then stream the post attachment from the site's own origin.
export const GET: APIRoute = async ({ params, cookies, locals, redirect, request }) => {
	const fileId = params.fileId;
	const token = cookies.get('token')?.value;
	const referer = safeRedirectPath(request.headers.get('referer'), '/', new URL(request.url).origin);

	if (!fileId || !/^\d+$/.test(fileId)) return redirect(`${referer}?error=${encodeURIComponent('معرف الملف غير صحيح.')}`);
	const result = await proxyDownload('post', fileId, locals.countryId, token ? `token=${token}` : undefined);

	if (!result.ok && result.status === 401) {
		return redirect(`/login?redirect_to=${encodeURIComponent(referer)}`);
	}
	if (!result.ok && result.status === 403) {
		return redirect(`${referer}?error=${encodeURIComponent('يرجى تفعيل بريدك الإلكتروني أولاً لتنزيل الملفات')}`);
	}
	if (!result.ok) return redirect(`${referer}?error=${encodeURIComponent(result.message)}`);
	return result.response;
};
