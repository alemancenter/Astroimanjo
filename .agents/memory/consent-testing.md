---
name: Consent and child-directed testing
description: Browser evidence for consent-gated ads must distinguish local state-machine tests from real Google account and IP-region validation.
---

The consent browser harness is intentionally dependency-free and uses fresh Chromium profiles, but its region labels simulate CMP outcomes rather than changing the public source IP.

**Why:** A passing local accept/reject/pending test proves the frontend gate and content availability, not that Google Privacy & Messaging shows the configured message or that the AdSense account applies child-directed treatment in a real geography.

**How to apply:** Keep local evidence in the repository, and require a separate live verification from EEA, UK, CH, and an outside region before enabling production ad slots.