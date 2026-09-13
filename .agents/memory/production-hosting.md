---
name: Production hosting and ads audit
description: External hosting detail that affects production verification and advertising checks.
---

The public imanjo.com site can be live on an external Nginx/Plesk host even when Replit reports no active deployment. Production `ads.txt`, CMP publisher IDs, and rendered ad markup must therefore be checked against the live domain, not inferred from Replit deployment metadata.

**Why:** A live-domain audit found a publisher mismatch between the externally served `ads.txt` and the Google Privacy & Messaging publisher script while the Replit deployment service reported no deployment.

**How to apply:** Treat Replit deployment status and the public domain as separate environments. Before enabling or reviewing AdSense, fetch the live domain, compare `ads.txt` with the publisher used by the CMP/AdSense client, and record any external-host sync step.