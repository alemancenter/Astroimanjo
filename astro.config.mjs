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
  vite: {
    plugins: [tailwindcss()]
  },

  adapter: node({
    mode: 'standalone'
  }),

  // No `image.domains` entry: article/post/category images come from
  // api.alemancenter.com/storage/, but that path is currently unreliable in
  // production (confirmed 404s across many files, both old and new upload
  // naming conventions — see src/lib/assets.ts). Astro's <Image> throws an
  // unhandled 500 on a failed remote fetch instead of degrading gracefully,
  // so until that backend/storage issue is fixed, these images are rendered
  // as plain <img> with onerror fallback (PostCard, CategoryCard, post hero).

  // Route-level response caching (Astro 7). Only routes with no per-visitor
  // personalization are listed here — the Header's login-state UI and the
  // article page's comments/reactions section (login-gated comment form,
  // per-comment reaction buttons) are both server:defer islands, so they
  // re-render fresh per request even on an otherwise-cached page.
  //
  // Deliberately NOT listed here: '/'. It resolves its country from the `country_id`
  // cookie (see middleware.ts), and Astro's memoryCache provider explicitly ignores the
  // Cookie header when building its cache key (IGNORED_VARY_HEADERS in
  // astro/dist/core/cache/memory-provider.js) — so caching it mixed one country's rendered
  // HTML into another's response. Confirmed live: a Jordan-cookie request populated the
  // cache, then a Saudi-cookie request got an X-Astro-Cache: HIT with byte-identical
  // (Jordanian) content. '/classes', '/categories', '/articles' used to have the same bug;
  // they're now redirect shims to their /{countryCode}/ equivalents below, so caching them
  // directly is no longer relevant (307s aren't cached here) and the country-scoped targets
  // are safe to cache since the country is part of the URL, not a cookie.
  cache: {
    provider: memoryCache(),
  },
  routeRules: {
    '/[countryCode]/classes': { maxAge: 300, swr: 3600, tags: ['classes'] },
    '/[countryCode]/categories': { maxAge: 300, swr: 3600, tags: ['categories'] },
    '/[countryCode]/articles': { maxAge: 120, swr: 600, tags: ['articles'] },
    '/[countryCode]/lesson/[classId]': { maxAge: 60, swr: 300, tags: ['classes'] },
    '/[countryCode]/lesson/[classId]/subjects/[subjectId]': { maxAge: 300, swr: 3600, tags: ['subjects'] },
    '/[countryCode]/lesson/subjects/[subjectId]': { maxAge: 300, swr: 3600, tags: ['subjects'] },
    // Article details deliberately remain uncached: ad eligibility is read from the latest
    // content-audit decision on every request. Serving a stale cached page after an article
    // becomes restricted could keep AdSense visible against the current policy decision.
    '/[countryCode]/lesson/articles/keyword/[keyword]': { maxAge: 300, swr: 1800, tags: ['articles'] },
    '/[countryCode]/posts': { maxAge: 60, swr: 300, tags: ['posts'] },
    // Post details also read the latest ad-eligibility decision and remain uncached
    // so a restricted-ads decision takes effect immediately.
    // Also tagged 'categories': this page displays the category's own name/slug inline, so
    // renaming a category (not just publishing/editing a post) must bust it too.
    '/[countryCode]/posts/category/[categoryId]': { maxAge: 60, swr: 300, tags: ['posts', 'categories'] },
    '/[countryCode]/posts/keyword/[keyword]': { maxAge: 300, swr: 1800, tags: ['posts'] },
  },
});
