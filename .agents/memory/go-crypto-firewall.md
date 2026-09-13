---
name: Go crypto firewall block
description: Why full backend tests may fail before compilation in the Replit environment.
---

Older pinned `golang.org/x/crypto` releases can be rejected by Replit's package firewall for a critical CVE. In this project, `v0.55.0` was accepted and allowed the backend packages to compile and test.

**Why:** The firewall blocks vulnerable archives before compilation; selecting a newer compatible module release restores verification without bypassing the security control.

**How to apply:** If dependency download is blocked, try the latest Go-compatible release through the normal module workflow, then rerun targeted and full tests. Never bypass the firewall.