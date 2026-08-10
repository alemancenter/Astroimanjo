import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { safeLegacyStorageUrl } from '../../lib/download-proxy';

export const prerender = false;

// Astro-native replacement for the legacy /api/img endpoint (confirmed, via response
// headers, to still be served by a separate Node/Express app — Helmet.js + express-rate-limit
// signatures, no trace of it anywhere in this project) — every article/post/category/settings
// image goes through assetUrl() to this exact path+query shape, so decommissioning that old
// app without this route existing first would break every image on the site instantly.
//
// Source files are read from {PUBLIC_SITE_URL}/storage/{src} — confirmed by direct curl
// (Last-Modified/ETag/Accept-Ranges, no app-layer headers at all) to be served by nginx
// directly from disk, independent of the old app — so this keeps working after that app is
// gone, same as download-proxy.ts's already-proven "legacy storage" fallback this reuses.

const FETCH_TIMEOUT_MS = 10_000;
const MAX_WIDTH = 2000;
// Safety net only, not a default resize — an unrequested source larger than this still gets
// capped so an arbitrarily huge uploaded file can't be re-encoded at full size on every request.
const MAX_UNREQUESTED_WIDTH = 4000;

export const GET: APIRoute = async ({ url }) => {
	const sourceUrl = safeLegacyStorageUrl(url.searchParams.get('src'));
	if (!sourceUrl) return new Response('Not found', { status: 404 });

	let requestedWidth: number | undefined;
	const widthParam = url.searchParams.get('w');
	if (widthParam) {
		const parsed = Number(widthParam);
		if (Number.isFinite(parsed) && parsed > 0) requestedWidth = Math.min(Math.round(parsed), MAX_WIDTH);
	}

	let upstream: Response;
	try {
		upstream = await fetch(sourceUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	} catch {
		return new Response('Upstream fetch failed', { status: 502 });
	}
	if (!upstream.ok || !upstream.body) {
		return new Response('Not found', { status: upstream.status === 404 ? 404 : 502 });
	}

	try {
		const inputBuffer = Buffer.from(await upstream.arrayBuffer());
		let pipeline = sharp(inputBuffer, { failOn: 'none' }).rotate(); // auto-orient via EXIF
		pipeline = requestedWidth
			? pipeline.resize({ width: requestedWidth, withoutEnlargement: true })
			: pipeline.resize({ width: MAX_UNREQUESTED_WIDTH, withoutEnlargement: true });
		const outputBuffer = await pipeline.webp({ quality: 82 }).toBuffer();

		return new Response(outputBuffer, {
			status: 200,
			headers: {
				'Content-Type': 'image/webp',
				'Cache-Control': 'public, max-age=31536000, immutable',
			},
		});
	} catch (error) {
		console.error('[api/img] processing failed:', error);
		return new Response('Image processing failed', { status: 502 });
	}
};
