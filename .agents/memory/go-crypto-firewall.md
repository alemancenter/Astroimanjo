---
name: Go crypto firewall block
description: Why full backend tests may fail before compilation in the Replit environment.
---

The pinned `golang.org/x/crypto` release is rejected by Replit's package firewall for a critical CVE, so `go test ./...` can fail during dependency download before compiling project code.

**Why:** This is an environment security block rather than evidence that the code under test failed.

**How to apply:** When validating backend changes, report this distinction and run dependency-independent tests where possible. Do not bypass the firewall; upgrade to a safe accepted release as a separate reviewed change.