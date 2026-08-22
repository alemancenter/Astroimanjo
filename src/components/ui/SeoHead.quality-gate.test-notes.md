# Phase 2E SEO gate assertions

The production build/type-check for this branch must validate these invariants in `SeoHead.astro`:

- Article detail routes call `/articles/:id/ad-status`.
- Post detail routes call `/posts/:id/ad-status`.
- `noindex, follow` is emitted only when the quality request succeeds and returns `indexable: false`, or when a page explicitly forces `noindex`.
- A quality API/network failure does not trigger `noindex`.
- Non-detail routes do not perform a quality lookup.

This file is temporary verification documentation and will be removed before merge.
