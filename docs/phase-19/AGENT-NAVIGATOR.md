# Phase 19 / P6 — Agent navigator («قدم بعدی چیست؟»)

```yaml
navigator_version: "2026-06-21-v1"
sole_entry: p6/AGENT-START.md
machine_snapshot: p6/AGENT-CURRENT-PHASE.yaml
umbrella: platform-denali-first-customer.mdoc
gate: pnpm run p6:gate
```

> **Use after** [`p6/AGENT-START.md`](p6/AGENT-START.md). Answers **what to read and do next** without browsing all 58 nanos.

---

## Decision tree (normative)

```text
START
  │
  ├─ IF AGENT-CURRENT-PHASE.status == COMPLETE AND p6:gate == PASS
  │    → STOP greenfield P6 implementation
  │    → READ: p6/appendices/IMPLEMENTATION-TRUTH-P6.md (repo truth)
  │    → READ: platform-denali-vertical-slice.mdoc (VS-01..08 reference)
  │    → RUN: pnpm run p6:gate (regression only)
  │    → IF regression: TRACEABILITY-MATRIX-P6.md → nano → fix · re-run gate
  │
  ├─ ELIF current_task starts with P6-0
  │    → READ: p6-host-addressing-architecture.mdoc · runbooks/host-subdomain-map.md
  │    → WRITE: packages/tenant-kernel/src/host/build-dev-portal-public-base-url.ts
  │    → FORBIDDEN: duplicate host logic in apps (use tenant-kernel helper)
  │    → PROVE: p6-host-tenant-parity.spec.ts · smoke-p6-host-bind.mjs
  │
  ├─ ELIF current_task starts with P6-1
  │    → PREREQ: P6-0 complete (host parity)
  │    → READ: p6-1-guest-slice.md · platform-portal-otp-flow.mdoc · p6-theming-file-tree.md
  │    → READ: p6-implementation-standards.mdoc (BFF · ui-primitives subpath · theming)
  │    → WRITE: apps/marketing · apps/portal (guest only — minimal admin publish)
  │    → FORBIDDEN: skip N-015 theming file tree · fork OTP logic in apps
  │    → PROVE: p6-guest-slice.spec.ts · guest-theme-stack · p6-theming-file-tree
  │    → MILESTONE: P6-1-N-014 GUEST_SLICE_OK on canonical hosts
  │
  ├─ ELIF current_task starts with P6-2
  │    → PREREQ: P6-1-N-014 GUEST_SLICE_OK
  │    → READ: p6-2-operator-admin.md · BOOKINGS-OPS-UX.md · FINANCE-OPS-UX.md
  │    → READ: runbooks/first-customer-operator.md (VS-06 · VS-07)
  │    → WRITE: apps/web (app)/ · apps/api bookings/finance (audit only — mostly trunk)
  │    → FORBIDDEN: delete denali rules/composites · denali-finance resurrection
  │    → PROVE: bookings-ops.spec.ts · p6-offline-receipt-gate · p6-preservation-gate
  │
  ├─ ELIF current_task starts with P6-3
  │    → PREREQ: P6-1-N-014 GUEST_SLICE_OK (parallel with P6-2 OK)
  │    → READ: platform-portal-member.mdoc · p6-3-member-portal.md
  │    → WRITE: apps/portal/app/me/** · app/api/me/**
  │    → API upstream: GET /bookings?view=mine (NOT new /denali/registrations/mine in P6)
  │    → FORBIDDEN: operator session on /me · direct API fetch from browser
  │    → PROVE: portal-member-registrations.spec.ts · portal-home-redirect.spec.ts
  │
  ├─ ELIF current_task starts with P6-4
  │    → PREREQ: P6-2 AND P6-3 complete
  │    → READ: p6-4-exit-gate.md · platform-denali-vertical-slice.mdoc
  │    → WRITE: scripts/p6-denali-product-gate.sh · package.json p6:gate
  │    → PROVE: platform-denali-first-customer-exit.spec.ts · p6:gate green
  │
  ├─ ELIF task is E2E / staging smoke (Architect YES)
  │    → READ: p6/runbooks/p6-e2e-smoke.md · SMOKE-SCENARIO-MAP-P6.md
  │    → RUN: pnpm run p6:e2e-gate then portal/marketing test:smoke
  │    → MANUAL: first-customer-operator.md VS-06/07
  │    → FINANCE DB: appendices/FINANCE-OPS-P6-NOTE.md when DATABASE_URL set
  │
  │    → UPDATE: DOC-SYNC-INDEX.md · p6-exit-checklist.md · AGENT-CURRENT-PHASE.yaml
  │    → RUN: pnpm run guard:p3-denali-covenant
  │
  └─ ELSE unknown state
       → RE-READ: p6/DOC-SYNC-INDEX.md · AGENT-CURRENT-PHASE.yaml
       → RUN: pnpm run p6:gate
       → EMIT: FAIL — cite blocker · halt
```

---

## Per-EPIC file bundle (quick index)

| EPIC | Spec | Architecture SoT | Runbook | Prove with |
| ---- | ---- | ---------------- | ------- | ---------- |
| **P6-0** | `p6/p6-0-host-subdomain.md` | `p6-host-addressing-architecture.mdoc` | `runbooks/host-subdomain-map.md` | `p6-host-tenant-parity.spec.ts` |
| **P6-1** | `p6/p6-1-guest-slice.md` | `p6-implementation-standards.mdoc` · `p6-theming-file-tree.md` | `runbooks/guest-slice-operator-minimal.md` | `p6-guest-slice.spec.ts` |
| **P6-2** | `p6/p6-2-operator-admin.md` | `BOOKINGS-OPS-UX.md` · `FINANCE-OPS-UX.md` | `runbooks/first-customer-operator.md` | `bookings-ops.spec.ts` |
| **P6-3** | `p6/p6-3-member-portal.md` | `platform-portal-member.mdoc` | — | `portal-member-*.spec.ts` |
| **P6-4** | `p6/p6-4-exit-gate.md` | `platform-denali-vertical-slice.mdoc` | `runbooks/staging-deploy.md` | `p6:gate` |

---

## Frozen FORBIDDEN (agent halt triggers)

| ID | Rule |
| -- | ---- |
| F-P6-01 | Import `@app-tour/ui-primitives` barrel in apps |
| F-P6-02 | Duplicate `buildDevPortalPublicBaseUrl` in marketing/web/portal |
| F-P6-03 | Merge portal register into `apps/web` long-term |
| F-P6-04 | Delete `packages/workspaces/denali/src/rules` or composites |
| F-P6-05 | New `GET /denali/registrations/mine` when `GET /bookings?view=mine` suffices |
| F-P6-06 | Browser → API direct call (must use BFF `app/api/*`) |
| F-P6-07 | Skip doc-first before `apps/api` / tenant-kernel / ui-primitives change |
| F-P6-08 | Re-implement closed nanos without regression proof |

---

## Agent loop (one nano)

```text
1. Read AGENT-CURRENT-PHASE.yaml → current_task
2. Read EPIC spec nano section (Do · Files · Verify)
3. Doc-first: update phase-19 mdoc if core change
4. Implement ONE nano only
5. pnpm run guard:p3-denali-covenant + nano Verify command
6. Update DOC-SYNC-INDEX · p6-exit-checklist · AGENT-CURRENT-PHASE.yaml
```

---

## References

- [AGENT-STATE-MAP-P6.md](p6/AGENT-STATE-MAP-P6.md) — VS + member session states
- [p6/appendices/IMPLEMENTATION-TRUTH-P6.md](p6/appendices/IMPLEMENTATION-TRUTH-P6.md) — repo truth before coding
- [p6/appendices/TRACEABILITY-MATRIX-P6.md](p6/appendices/TRACEABILITY-MATRIX-P6.md) — nano → file → spec
- [p6/appendices/SMOKE-SCENARIO-MAP-P6.md](p6/appendices/SMOKE-SCENARIO-MAP-P6.md) — SMK-P6 scenarios
- [p6/appendices/FINANCE-OPS-P6-NOTE.md](p6/appendices/FINANCE-OPS-P6-NOTE.md)
- [p6/appendices/OTP-SCOPE-P6.md](p6/appendices/OTP-SCOPE-P6.md)
- [p6/runbooks/p6-e2e-smoke.md](p6/runbooks/p6-e2e-smoke.md)
