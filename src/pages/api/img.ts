import type { APIRoute } from 'astro';
import sharp from 'sharp';

export const prerender = false;

/*
 * Images are stored by the Go backend and exposed through /storage.
 *
 * Astro and Go run on the same server, so the image proxy must fetch the
 * source through the private loopback connection rather than making an
 * unnecessary public HTTPS round trip through api.imanjo.com/Nginx.
 */
const INTERNAL_API_URL =
  import.meta.env.INTERNAL_API_URL || 'http://127.0.0.1:8187/api';

let INTERNAL_STORAGE_ORIGIN = 'http://127.0.0.1:8187';

try {
  INTERNAL_STORAGE_ORIGIN = new URL(INTERNAL_API_URL).origin;
} catch {
  // Safe production fallback remains loopback-only.
}

const FETCH_TIMEOUT_MS = 10_000;
const MAX_WIDTH = 2000;
const MAX_UNREQUESTED_WIDTH = 4000;


/**
 * Build a storage URL without permitting traversal or arbitrary URL fetching.
 *
 * Accepted examples:
 *   settings/image.png
 *   images/posts/image.jpg
 *   posts/legacy-image.jpg
 *   storage/images/posts/image.jpg
 */
function safeInternalStorageUrl(rawPath: string | null): string | null {
  if (!rawPath || rawPath.length > 4096) return null;

  let path = rawPath.trim();

  if (!path) return null;

  // Reject absolute/external protocols:
  // http:, https:, file:, data:, javascript:, etc.
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return null;

  // Normalize an optional leading /storage/.
  path = path
    .replace(/^\/?storage\//, '')
    .replace(/^\/+/, '');

  if (
    !path ||
    path.includes('\0') ||
    path.includes('\\')
  ) {
    return null;
  }

  const segments = path.split('/');

  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..'
    )
  ) {
    return null;
  }

  /*
   * Decode each segment twice to catch encoded and double-encoded traversal:
   * %2e%2e
   * %252e%252e
   * %2f
   * %255c
   */
  for (const segment of segments) {
    let decoded = segment;

    for (let i = 0; i < 2; i++) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        return null;
      }

      if (
        decoded === '.' ||
        decoded === '..' ||
        decoded.includes('/') ||
        decoded.includes('\\') ||
        decoded.includes('\0')
      ) {
        return null;
      }
    }
  }

  const encodedPath = segments
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${INTERNAL_STORAGE_ORIGIN}/storage/${encodedPath}`;
}


export const GET: APIRoute = async ({ url }) => {
  const sourceUrl = safeInternalStorageUrl(
    url.searchParams.get('src')
  );

  if (!sourceUrl) {
    return new Response('Not found', {
      status: 404,
    });
  }


  // -------------------------------------------------------
  // Width validation
  // -------------------------------------------------------

  const rawWidth = url.searchParams.get('w');

  let requestedWidth: number | undefined;

  if (rawWidth) {
    const parsed = Number.parseInt(rawWidth, 10);

    if (
      !Number.isFinite(parsed) ||
      parsed <= 0
    ) {
      return new Response('Invalid width', {
        status: 400,
      });
    }

    requestedWidth = Math.min(
      parsed,
      MAX_WIDTH
    );
  }


  // -------------------------------------------------------
  // Fetch original image from private Go storage endpoint
  // -------------------------------------------------------

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    FETCH_TIMEOUT_MS
  );

  let upstream: Response;

  try {
    upstream = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'image/*',
      },
    });
  } catch {
    clearTimeout(timeout);

    return new Response(
      'Image source unavailable',
      {
        status: 502,
      }
    );
  }

  clearTimeout(timeout);


  if (!upstream.ok) {
    return new Response(
      'Not found',
      {
        status:
          upstream.status === 404
            ? 404
            : 502,
      }
    );
  }


  // Never process arbitrary non-image data through Sharp.
  const contentType =
    upstream.headers.get('content-type') || '';

  if (
    !contentType
      .toLowerCase()
      .startsWith('image/')
  ) {
    return new Response(
      'Not found',
      {
        status: 404,
      }
    );
  }


  // -------------------------------------------------------
  // Read source
  // -------------------------------------------------------

  let buffer: Buffer;

  try {
    buffer = Buffer.from(
      await upstream.arrayBuffer()
    );
  } catch {
    return new Response(
      'Image source unavailable',
      {
        status: 502,
      }
    );
  }


  // -------------------------------------------------------
  // Optimize image
  // -------------------------------------------------------

  try {
    let pipeline = sharp(buffer).rotate();

    if (requestedWidth) {
      pipeline = pipeline.resize({
        width: requestedWidth,
        withoutEnlargement: true,
      });
    } else {
      pipeline = pipeline.resize({
        width: MAX_UNREQUESTED_WIDTH,
        withoutEnlargement: true,
      });
    }

    const output = await pipeline
      .webp({
        quality: 82,
      })
      .toBuffer();

    return new Response(output, {
      status: 200,

      headers: {
        'Content-Type': 'image/webp',

        /*
         * src paths are immutable upload paths in normal use.
         * Browser/CDN may therefore cache the optimized result.
         */
        'Cache-Control':
          'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response(
      'Image processing failed',
      {
        status: 500,
      }
    );
  }
};
