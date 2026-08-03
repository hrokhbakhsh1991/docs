---
title: Thin Shell — Remaining checklist (post-binder)
format: markdown
doc_role: architecture_sot
promoted_from: TEMP/THIN_SHELL_REMAINING_CHECKLIST.md
---

# Thin Shell — Remaining checklist

> **Promoted from gitignored `TEMP/`** (Wave-0 / PSR-2c). CI and thin-shell guards must read this clone-addressable path — never reintroduce repo-root `TEMP/` for gate green.

Phase **4bz** closes the post-binder optional polish track. See also [`thin-shell-post-binder-closure.mdoc`](./thin-shell-post-binder-closure.mdoc).

## Remaining after binder closure

**Post-binder optional list:** closed (4bl–4by → **4bz**).

No open polish items remain on the numbered post-binder list. Tracks **4bx** (Operator-clean naming inventory) and **4by** (host-probe Playwright) are recorded as closed in the Phase 4bz closure doc.

## Architect-only remaining gates

These require explicit Architect YES (do not start casually):

1. Dual-SOT capability-stub codegen / drop redundant packaging keys
2. Capability-bag coarse fold in SDK types
3. Package `Denali*` rename waves inside `@app-tour/workspace-denali`
4. Hostile audit V7+ / claim ≥90 (must not delete §2.4 registries to chase score)
5. Live browser run of host-probe E2E against a standing Next (`HOST_PROBE_E2E=1`)

## Historical note (stale P0 — do not reopen)

Previous scratch checklist rows that claimed Form binder / naming / E2E as still open were cleared in Phase **4bz**. Do not restore unchecked P0 claims for those tracks.
