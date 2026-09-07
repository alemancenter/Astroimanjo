import type { APIRoute } from 'astro';
import { COUNTRIES } from '../lib/countries';

export const prerender = false;

const INTERNAL_API_URL =
  import.meta.env.INTERNAL_API_URL || 'http://127.0.0.1:8187/api';

const INTERNAL_ORIGIN = new URL(INTERNAL_API_URL).origin;

export const GET: APIRoute = async () => {
  try {
    // Build one standards-compliant index of the leaf maps that actually
    // exist. Sitemap indexes should not be nested, so returning the Jordan
    // index alone (the previous behavior) silently hid the other databases.
    const indexes = await Promise.all(
      COUNTRIES.map(async ({ code }) => {
        try {
          const upstream = await fetch(
            `${INTERNAL_ORIGIN}/storage/sitemaps/sitemap_index_${code}.xml`,
            {
              signal: AbortSignal.timeout(10_000),
              headers: { Accept: 'application/xml,text/xml' },
            },
          );
          return upstream.ok ? upstream.text() : '';
        } catch {
          return '';
        }
      }),
    );
    const entries = indexes.flatMap((xml) => xml.match(/<sitemap>[\s\S]*?<\/sitemap>/g) || []);
    if (!entries.length) return new Response('Sitemap unavailable', { status: 404 });
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</sitemapindex>`;

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
