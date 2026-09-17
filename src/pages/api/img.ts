import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { readBoundedBody } from '../../lib/bounded-body';
import { safeInternalStorageUrl } from '../../lib/image-source';
export const prerender = false;
const origin = new URL(import.meta.env.INTERNAL_API_URL || 'http://127.0.0.1:8082/api').origin;
const widths = [96, 160, 320, 480, 640, 960, 1200, 1600, 2000];
type ImageResult = {body: Buffer; contentType: string};
const cache = new Map<string, {body: Buffer; contentType: string; expires: number}>();
let bytes = 0;
const flights = new Map<string, Promise<ImageResult>>();
const MAX_CACHE_BYTES = 32 * 1024 * 1024;
// libvips (sharp's decoder) has no ICO support at all — every .ico source throws "unsupported
// image format" and used to surface as a 502. Favicons are already tiny, so there is nothing
// worth resizing/re-encoding here anyway: pass the bytes through untouched instead.
const ICO_CONTENT_TYPES = new Set(['image/x-icon', 'image/vnd.microsoft.icon']);
function remember(key: string, entry: ImageResult) {
 if (entry.body.length > MAX_CACHE_BYTES) return;
 const old = cache.get(key); if (old) { bytes -= old.body.length; cache.delete(key); }
 for (const [k, existing] of cache) {
  if (bytes + entry.body.length <= MAX_CACHE_BYTES && cache.size < 256) break;
  bytes -= existing.body.length; cache.delete(k);
 }
 cache.set(key, {...entry, expires: Date.now() + 3600_000}); bytes += entry.body.length;
}
async function transform(source: string, width: number): Promise<ImageResult> {
 const response = await fetch(source, {signal: AbortSignal.timeout(10_000), redirect:'error', headers:{Accept:'image/*'}});
 const sourceContentType = response.headers.get('content-type');
 if (!response.ok || !sourceContentType?.startsWith('image/')) {
  await response.body?.cancel(); throw new Error('Image unavailable');
 }
 const input = await readBoundedBody(response, 10 * 1024 * 1024);
 if (ICO_CONTENT_TYPES.has(sourceContentType) || source.toLowerCase().endsWith('.ico')) {
  return {body: input, contentType: 'image/x-icon'};
 }
 const body = await sharp(input, {limitInputPixels: 40_000_000}).rotate().resize({width, withoutEnlargement:true}).webp({quality:82}).timeout({seconds:10}).toBuffer();
 return {body, contentType: 'image/webp'};
}
export const GET: APIRoute = async ({url}) => {
 const source = safeInternalStorageUrl(url.searchParams.get('src'), origin);
 if (!source) return new Response('Not found', {status:404});
 const raw = url.searchParams.get('w');
 const parsed = raw === null ? 2000 : Number(raw);
 if (!Number.isInteger(parsed) || parsed <= 0) return new Response('Invalid width', {status:400});
 const width = widths.find(w => w >= parsed) ?? 2000;
 const key = `${source}:${width}`;
 const baseHeaders = {'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'};
 const entry = cache.get(key);
 if (entry && entry.expires > Date.now()) return new Response(new Uint8Array(entry.body), {headers:{...baseHeaders,'Content-Type':entry.contentType}});
 let flight = flights.get(key);
 if (!flight) {
  if (flights.size >= 4) return new Response('Image service busy', {status:503,headers:{'Retry-After':'2','Cache-Control':'no-store'}});
  flight = transform(source, width); flights.set(key, flight);
 }
 try {
  const output = await flight; remember(key, output);
  return new Response(new Uint8Array(output.body), {headers:{...baseHeaders,'Content-Type':output.contentType}});
 } catch { return new Response('Image unavailable', {status:502,headers:{'Cache-Control':'no-store'}}); }
 finally { if (flights.get(key) === flight) flights.delete(key); }
};
