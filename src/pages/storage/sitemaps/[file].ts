import type { APIRoute } from 'astro';

export const prerender = false;

const INTERNAL_API_URL =
  import.meta.env.INTERNAL_API_URL || 'http://127.0.0.1:8187/api';

const INTERNAL_ORIGIN =
  new URL(INTERNAL_API_URL).origin;

const ALLOWED_FILE = /^sitemap_(?:index|articles|post|static|images|videos|news)_(?:jo|sa|eg|ps)\.xml$/;

export const GET: APIRoute = async ({ params }) => {
  const file = params.file || '';

  if (!ALLOWED_FILE.test(file)) {
    return new Response(
      'Not found',
      {
        status: 404,
      }
    );
  }

  try {
    const upstream = await fetch(
      `${INTERNAL_ORIGIN}/storage/sitemaps/${file}`,
      {
        signal: AbortSignal.timeout(10_000),
        headers: {
          Accept: 'application/xml,text/xml',
        },
      }
    );

    if (!upstream.ok) {
      return new Response(
        'Not found',
        {
          status: upstream.status === 404 ? 404 : 502,
        }
      );
    }

    const xml = await upstream.text();

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Robots-Tag': 'noindex',
      },
    });

  } catch {
    return new Response(
      'Sitemap unavailable',
      {
        status: 502,
      }
    );
  }
};
