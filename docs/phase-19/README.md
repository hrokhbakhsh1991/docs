# Phase 19 — P6 Denali first customer

```yaml
pack_version: "2.3-fast-close"
nanos: 58
status: CLOSED_FAST
fast_close: p6/p6-fast-close.yaml
doc_pack: COMPLETE
code_integration: DEV_SLICE_CLOSED
execution_order: [P6-0, P6-1, P6-2, P6-3, P6-4]
milestone_guest_slice: P6-1-N-014
gate_static: pnpm run p6:gate
gate_closure_fast: P6_FAST_CLOSE=1 pnpm run p6:closure
gate_live: node scripts/smoke-p6-host-bind.mjs
navigator: AGENT-NAVIGATOR.md
p7_blocked: false
long_commands: ../TEMP/FOR YOU.md
```

## Start

→ [p6/AGENT-START.md](p6/AGENT-START.md) · **status:** CLOSED_FAST · **P7** unblocked

Long VPS/build/gate commands: **[TEMP/FOR YOU.md](../TEMP/FOR%20YOU.md)**

## Umbrella

→ [platform-denali-first-customer.mdoc](platform-denali-first-customer.mdoc)

## Addressing (mandatory before host work)

→ [p6-host-addressing-architecture.mdoc](p6-host-addressing-architecture.mdoc) · [p6/runbooks/host-subdomain-map.md](p6/runbooks/host-subdomain-map.md)

## Theming (mandatory before guest UI)

→ [p6-enterprise-theming-architecture.mdoc](p6-enterprise-theming-architecture.mdoc) · [p6-implementation-standards.mdoc](p6-implementation-standards.mdoc) · [p6/p6-theming-file-tree.md](p6/p6-theming-file-tree.md)

## Prerequisite

P5 complete (`P5-B-N-016`). P6 does not change P5.

## Three apps (dev canonical)

| App | Host | Legacy smoke |
| --- | ---- | ------------ |
| `apps/marketing` | `{club}.localhost:3002` | `shop.{club}.localhost:3002` |
| `apps/portal` | `{club}.portal.localhost:3003` | `{club}.localhost:3003` |
| `apps/web` admin | `{club}.admin.localhost:3000` | `{club}.localhost:3000` |

Prod platform: `{club}.{root}` · `{club}.portal.{root}` · `{club}.admin.{root}`.

Custom apex (per tenant): `denali.club` · `portal.denali.club` · `admin.denali.club`.

## EPICs (order)

| EPIC | Doc | Nanos | Priority |
| ---- | --- | ----- | -------- |
| P6-0 | [p6-0-host-subdomain.md](p6/p6-0-host-subdomain.md) | 9 | Dual host + tenant parity |
| P6-1 | [p6-1-guest-slice.md](p6/p6-1-guest-slice.md) | 15 | **Browse → register** |
| P6-2 | [p6-2-operator-admin.md](p6/p6-2-operator-admin.md) | 16 | Full admin |
| P6-3 | [p6-3-member-portal.md](p6/p6-3-member-portal.md) | 10 | `/me` + receipt |
| P6-4 | [p6-4-exit-gate.md](p6/p6-4-exit-gate.md) | 8 | Gate + staging |

## Progress & appendices

→ [p6/DOC-SYNC-INDEX.md](p6/DOC-SYNC-INDEX.md) · [p6/p6-exit-checklist.md](p6/p6-exit-checklist.md)

| Appendix | Role |
| -------- | ---- |
| [p6/appendices/IMPLEMENTATION-TRUTH-P6.md](p6/appendices/IMPLEMENTATION-TRUTH-P6.md) | Repo truth — read before any P6 code change |
| [p6/appendices/TRACEABILITY-MATRIX-P6.md](p6/appendices/TRACEABILITY-MATRIX-P6.md) | 58 nanos → files → specs |
| [p6/appendices/SMOKE-SCENARIO-MAP-P6.md](p6/appendices/SMOKE-SCENARIO-MAP-P6.md) | SMK-P6 scenarios |
| [p6/runbooks/p6-e2e-smoke.md](p6/runbooks/p6-e2e-smoke.md) | T2 browser E2E (Architect YES) |
| [p6/appendices/FINANCE-OPS-P6-NOTE.md](p6/appendices/FINANCE-OPS-P6-NOTE.md) | finance-ops when Postgres |
| [p6/appendices/OTP-SCOPE-P6.md](p6/appendices/OTP-SCOPE-P6.md) | OTP share scope |
| [p6/FILE-MAP.md](p6/FILE-MAP.md) | Full file index |

## Member Portal Shell RFC (post-P6 — pending sign-off)

Architecture promotion from Blueprint v9. **Documentation only — not implementation authorization.**

| Document | Role |
| -------- | ---- |
| [platform-portal-member-shell-architecture.mdoc](platform-portal-member-shell-architecture.mdoc) | RFC — goals, architecture, routing, phases |
| [member-portal-shell/decision-log.mdoc](member-portal-shell/decision-log.mdoc) | DL-01 … DL-42 + traceability matrix |
| [member-portal-shell/builder-migration-contract.mdoc](member-portal-shell/builder-migration-contract.mdoc) | GSH builder migration (DL-22) |
| [member-portal-shell/routing-builders-authority.mdoc](member-portal-shell/routing-builders-authority.mdoc) | GSH vs web shim vs portal-local |
| [member-portal-shell/phase-mapping.mdoc](member-portal-shell/phase-mapping.mdoc) | PS-N ↔ BP-N ↔ gates ↔ DL |
| [member-portal-shell/cleanup-roadmap.mdoc](member-portal-shell/cleanup-roadmap.mdoc) | BP-8 / PS-7 cleanup phase |
| [member-portal-shell/guest-cross-surface-nav-schema.mdoc](member-portal-shell/guest-cross-surface-nav-schema.mdoc) | guestCrossSurfaceNav schema (DL-05) |
| [member-portal-shell/glossary.mdoc](member-portal-shell/glossary.mdoc) | Canonical terminology |
| [member-portal-shell/implementation-gates.mdoc](member-portal-shell/implementation-gates.mdoc) | Phase prerequisites, DoD, rollback |
| [member-portal-shell/repository-gap-report.md](member-portal-shell/repository-gap-report.md) | PS-1..PS-5 closure audit + PS-6 open gaps |
| [member-portal-shell/readiness-report.md](member-portal-shell/readiness-report.md) | Readiness assessment |
| [member-portal-shell/member-portal-registry-schema.mdoc](member-portal-shell/member-portal-registry-schema.mdoc) | memberPortal registry + dispatcher schema |
| [platform-portal-member-entitlements.mdoc](platform-portal-member-entitlements.mdoc) | Entitlements BFF contract (DL-09) — **shipped bootstrap** |
| [../standards/wrs-portal-member-routing-addendum.mdoc](../standards/wrs-portal-member-routing-addendum.mdoc) | WRS routing addendum (DL-41) |
| [../dev/guard-member-portal-registry.md](../dev/guard-member-portal-registry.md) | Guard specifications |
| [../standards/member-session-portal-authority.mdoc](../standards/member-session-portal-authority.mdoc) | PCMS-003 Phase 3 follow-up §5.1 |

Source blueprint (temporary): [../temp/DENALI-PORTAL-SHELL-NAVIGATION-BLUEPRINT.md](../temp/DENALI-PORTAL-SHELL-NAVIGATION-BLUEPRINT.md)

## Superseded (v1.0)

Old EPIC ids `P6-A` … `P6-D` replaced in v2.0 — see `DOC-SYNC-INDEX.yaml` `deprecated_epics`.
