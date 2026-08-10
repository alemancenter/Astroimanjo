import { apiRawFetch, UPLOAD_TIMEOUT_MS } from './api';

type DownloadKind = 'article' | 'post';

export type DownloadProxyResult =
	| { ok: true; response: Response }
	| { ok: false; status: number; message: string };

const LEGACY_STORAGE_ORIGIN = (import.meta.env.PUBLIC_SITE_URL || 'https://imanjo.com').replace(/\/$/, '');

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

export function safeLegacyStorageUrl(rawPath: unknown): string | null {
	if (typeof rawPath !== 'string') return null;
	const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^storage\//, '');
	const segments = normalized.split('/').filter(Boolean);
	if (!segments.length || segments.some((segment) => segment === '.' || segment === '..')) return null;
	return `${LEGACY_STORAGE_ORIGIN}/storage/${segments.map(encodeURIComponent).join('/')}`;
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

		// Production still contains Laravel-era files under the public site's storage root.
		// Fall back only after the signed API validates the file/token but cannot read its disk path.
		if (signedResponse.status !== 404) {
			return { ok: false, status: signedResponse.status, message: 'تعذّر قراءة الملف من الخادم.' };
		}

		const infoResponse = await apiRawFetch(`/files/${encodeURIComponent(fileId)}/info`, { countryId });
		const infoPayload: any = await infoResponse.json().catch(() => null);
		const file = infoPayload?.data?.file;
		const actualKind = infoPayload?.data?.type;
		if (!infoResponse.ok || !file || (actualKind && actualKind !== kind)) {
			return { ok: false, status: 404, message: 'الملف المطلوب غير موجود.' };
		}

		const legacyUrl = safeLegacyStorageUrl(file.file_path);
		if (!legacyUrl) return { ok: false, status: 404, message: 'مسار الملف غير صالح.' };

		const legacyResponse = await fetch(legacyUrl, {
			headers: { Accept: 'application/octet-stream,*/*' },
			redirect: 'error',
			signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
		});
		if (!legacyResponse.ok || !legacyResponse.body) {
			return { ok: false, status: legacyResponse.status, message: 'الملف مسجل لكن نسخته غير متوفرة في التخزين.' };
		}

		return {
			ok: true,
			response: proxiedFileResponse(legacyResponse, file.file_name, file.mime_type),
		};
	} catch (error) {
		console.error(`[download-proxy] ${kind} file ${fileId} failed:`, error);
		return { ok: false, status: 502, message: 'تعذّر الاتصال بخادم الملفات، حاول مرة أخرى.' };
	}
}
