import { apiRawFetch, UPLOAD_TIMEOUT_MS } from './api';

type DownloadKind = 'article' | 'post';

export type DownloadProxyResult =
	| { ok: true; response: Response }
	| { ok: false; status: number; message: string };

function attachmentDisposition(fileName: string, extension: string): string {
	const safeExtension = extension.replace(/[^a-z0-9]/gi, '').slice(0, 10) || 'bin';
	const encoded = encodeURIComponent(fileName.replace(/[\r\n]/g, ''));
	return `attachment; filename="download.${safeExtension}"; filename*=UTF-8''${encoded}`;
}

function proxiedFileResponse(upstream: Response, fallbackName?: string, fallbackType?: string): Response {
	const headers = new Headers({
		'Content-Type': upstream.headers.get('content-type') || fallbackType || 'application/octet-stream',
		'Content-Disposition': upstream.headers.get('content-disposition') || attachmentDisposition(fallbackName || 'download.bin', fallbackName?.split('.').pop() || 'bin'),
		'Cache-Control': 'private, no-store, max-age=0',
		'X-Content-Type-Options': 'nosniff',
		'Referrer-Policy': 'no-referrer',
	});
	const length = upstream.headers.get('content-length');
	if (length) headers.set('Content-Length', length);
	return new Response(upstream.body, { status: 200, headers });
}

/**
 * Streams a protected download through Astro, keeping the signed token and the
 * physical storage URL away from browser history. The legacy storage fallback
 * is deliberately server-side and only uses a path returned by the trusted API.
 */
export async function proxyDownload(
	kind: DownloadKind,
	fileId: string,
	countryId: string,
	cookieHeader?: string,
): Promise<DownloadProxyResult> {
	try {
		const prefix = kind === 'post' ? '/posts' : '/articles';
		const tokenResponse = await apiRawFetch(`${prefix}/file/${encodeURIComponent(fileId)}/download-url`, {
			countryId,
			cookieHeader,
		});

		if (tokenResponse.status === 401 || tokenResponse.status === 403) {
			return { ok: false, status: tokenResponse.status, message: '' };
		}

		const tokenPayload: any = await tokenResponse.json().catch(() => null);
		const signedToken = tokenPayload?.data?.token;
		if (!tokenResponse.ok || !signedToken) {
			return { ok: false, status: tokenResponse.status, message: 'تعذّر تحضير رابط التنزيل، حاول مرة أخرى.' };
		}

		// The token travels in a request header, not in the browser URL or API access logs.
		let signedResponse = await apiRawFetch(`${prefix}/download`, {
			countryId,
			cookieHeader,
			headers: { 'X-Download-Token': signedToken },
			timeoutMs: UPLOAD_TIMEOUT_MS,
		});
		// Compatibility during a rolling deployment: the previous API release only
		// accepts the token as a query value. This retry remains server-to-server.
		if (signedResponse.status === 400) {
			signedResponse = await apiRawFetch(`${prefix}/download`, {
				countryId,
				cookieHeader,
				params: { token: signedToken },
				timeoutMs: UPLOAD_TIMEOUT_MS,
			});
		}
		if (signedResponse.ok && signedResponse.body) return { ok: true, response: proxiedFileResponse(signedResponse) };

        return { ok: false, status: signedResponse.status, message: 'الملف غير متوفر في التخزين، يرجى التواصل مع الإدارة.' };
	} catch (error) {
		console.error(`[download-proxy] ${kind} file ${fileId} failed:`, error);
		return { ok: false, status: 502, message: 'تعذّر الاتصال بخادم الملفات، حاول مرة أخرى.' };
	}
}
