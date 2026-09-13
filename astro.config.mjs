// @ts-check
import { defineConfig, memoryCache } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  // Astro uses this to resolve absolute URLs (canonical, og:url, sitemap) for prerendered
  // pages, which have no real incoming request to read an origin from at build time —
  // without it they fall back to Astro's dev-server placeholder (http://localhost:4321),
  // which is exactly what ended up baked into the `dist/` output for every prerendered
  // legal/info page. Reuses the same domain as PUBLIC_SITE_URL (src/lib/assets.ts) rather
  // than hardcoding it a second time.
  site: process.env.PUBLIC_SITE_URL || 'https://imanjo.com',
  output: 'server',

  // IMANJO_PERFORMANCE_INLINE_CSS_V1
  // Keep project CSS in the initial HTML to remove stylesheet requests
  // from the critical rendering path.
  build: {
    inlineStylesheets: 'always',
  },
  vite: {
    plugins: [tailwindcss()]
  },

  adapter: node({
    mode: 'standalone'
  }),

  // Mutation origins are validated in src/middleware.ts against PUBLIC_SITE_URL.
  // This remains correct when TLS terminates at the trusted reverse proxy.
  security: {
    checkOrigin: false,
    allowedDomains: [{ hostname: 'imanjo.com' }],
  },

  // No `image.domains` entry: article/post/category images come from
  // api.imanjo.com/storage/, but that path is currently unreliable in
  // production (confirmed 404s across many files, both old and new upload
  // naming conventions — see src/lib/assets.ts). Astro's <Image> throws an
  // unhandled 500 on a failed remote fetch instead of degrading gracefully,
  // so until that backend/storage issue is fixed, these images are rendered
  // as plain <img> with onerror fallback (PostCard, CategoryCard, post hero).

  // APIContext.cache stays available to existing invalidation calls, but rendered
  // content responses are not cached while publication/eligibility is mutable.
  cache: {
    provider: memoryCache(),
  },

  // The ImanSEO + content-audit + content-quality subsystem (AI-assisted analysis, batch
  // fixes, readiness reports, corruption/similarity/inventory scans) was removed entirely.
  // Google Search Console survives as its own standalone page (/dashboard/gsc — real Google
  // data, no AI). These 301s keep old bookmarks / inbound links from 404ing outright.
  redirects: {
    '/dashboard/seo/search-console': { status: 301, destination: '/dashboard/gsc' },
    '/dashboard/seo': { status: 301, destination: '/dashboard' },
    '/dashboard/seo/[...slug]': { status: 301, destination: '/dashboard' },
    '/dashboard/content-audit': { status: 301, destination: '/dashboard' },
    '/dashboard/content-audit/[...slug]': { status: 301, destination: '/dashboard' },
    '/dashboard/content-quality': { status: 301, destination: '/dashboard' },
    '/dashboard/quality': { status: 301, destination: '/dashboard' },
  },
  // Public rendering reads current publication/eligibility; service caches own data TTLs.
  routeRules: {},
});
