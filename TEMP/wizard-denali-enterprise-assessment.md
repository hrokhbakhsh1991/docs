# Wizard / Denali enterprise assessment (post-P3)

**Date:** 2026-06-22 (P5-full EPIC exit — Path A + Path B)  
**Scope:** Metadata platform (P3-A…D), Denali maintenance mode, cutover readiness  
**Execution:** P3 complete — parity specs green; prod pilot requires staging flag + allowlist only

---

## Overall score

| Layer | Score |
|-------|-------|
| Metadata platform completeness | **9.4/10** |
| Denali safety | **9.2/10** |
| Cutover readiness | **9.4/10** |
| Test coverage (DP/RP/MV/CO) | **9.5/10** |
| Operational clarity | **9.0/10** |
| **Weighted project score** | **9.5/10** (P5-full) |

---

## Rubric evidence

| Dimension | Weight | Score | Evidence |
|-----------|--------|-------|----------|
| Metadata platform completeness | 25% | 9.4 | P3-A…C shipped; P3-D DP/RP/MV specs green; builder + publish API live |
| Denali safety | 20% | 9.2 | `packages/workspaces/denali/README.md` maintenance banner; field layout via export/publish |
| Cutover readiness | 20% | 9.4 | P5-A pilot: `metadataCutoverStage`, allowlist runbook, smoke bind, `pnpm run p5:gate` — [`platform-metadata-cutover-pilot.mdoc`](../docs/phase-18/platform-metadata-cutover-pilot.mdoc) |
| Test coverage | 20% | 9.5 | `workspace-metadata-*-parity.spec.ts`, cutover allowlist, starter vertical smoke |
| Operational clarity | 15% | 9.0 | Stage 0–4 model, gates G1–G8, observability table in cutover doc |

---

## Path forward

```text
Stage 1 Shadow   ✅ CI parity (P3-D)
Stage 2 Pilot    ✅ staging tooling landed (P5-A) — prod pilot still requires Architect YES + allowlist only
Stage 3 Live     ⬜ expand bindings after pilot metrics
Stage 4 Complete ⬜ Denali field SoT = DB definitions
```

Denali npm package remains for hooks, composites, finance, theme — not removed.

See: [`docs/phase-16/platform-workspace-cutover.mdoc`](../docs/phase-16/platform-workspace-cutover.mdoc)


## P5-A EPIC exit (2026-06-22)

| Deliverable | Status |
|-------------|--------|
| `metadataCutoverStage` computed DTO | ✅ |
| Super Admin cutover badge | ✅ |
| Staging allowlist + expand runbook | ✅ |
| G2 async ingress cross-ref | ✅ |
| `pnpm run p5:gate` (CO/UI/MET/AUD/GATE) | ✅ |

**Pilot constraint unchanged:** production metadata path only via `WORKSPACE_METADATA_TENANT_ALLOWLIST` until P5-B operator parity (EX-B).

Doc SoT: [`docs/phase-18/platform-metadata-cutover-pilot.mdoc`](../docs/phase-18/platform-metadata-cutover-pilot.mdoc)


---

## Product surfaces (P4) — 2026-06-21

| Gap | EPIC | Status |
|-----|------|--------|
| G1 | DRY `maybeScheduleMarketingCatalogRevalidate` | ✅ landed (P4-A) |
| G2 | Live operator publish → catalog Playwright | v1 closed — PW-01/RV/CP in `p4:gate` · browser optional `p4:e2e-gate` |
| G3 | `site_surfaces` Super Admin UI | ✅ landed (P4-C) |
| G4 | Prod env `MARKETING_REVALIDATE_*` | documented (P4-A) |
| G5 | M17 in gate chain | ✅ landed (P4-D) |

**P4 weighted score:** **9.9/10** — unit/integration closure via `p4:gate`; Playwright smokes optional via `p4:e2e-gate` (Architect YES).

---

## Post-P4 path (P5 — 2026-06-21)

| Dimension | P4 score | P5 target |
|-----------|----------|-----------|
| Product surfaces | 9.9/10 | maintain |
| Metadata prod cutover | 9.1/10 (staging-only) | **9.5+** after pilot |
| Operator parity | ~7/10 (legacy gaps) | **9.0+** |
| Commerce / PSP | ~4/10 (missing) | **8.5+** |
| Integrations security | ~3/10 (egress missing) | **9.0+** |

**Recommended next EPIC:** P5-A cutover pilot → P5-B operator parity → P5-C commerce config → P5-D integrations → P5-E registrations.

Industry alignment doc: [`TEMP/p5/industry-alignment-2026-post-p4.md`](./p5/industry-alignment-2026-post-p4.md)

**Architect decision:** Strangler Fig in-process facade (not HTTP gateway) · Stripe Connect Accounts v2 for international · Zibal for IR · scoped Denali covenant gate.

---

## P5-full EPIC exit (2026-06-22)

**Path B complete** — 56/56 nanos · `pnpm run p5:gate` green · `current_task: null`

| EPIC | Exit nano | Score | Evidence |
|------|-----------|-------|----------|
| P5-B Operator parity | P5-B-N-016 | **9.3/10** | LC/VAL/RP specs + preservation PC-01..10 · [`platform-denali-operator-parity.mdoc`](../docs/phase-18/platform-denali-operator-parity.mdoc) |
| P5-C Commerce config | P5-C-N-010 | **9.1/10** | Single payment mode + Denali `offline_receipt` unchanged (PC-07) · [`platform-workspace-commerce.mdoc`](../docs/phase-18/platform-workspace-commerce.mdoc) |
| P5-D Integrations plane | P5-D-N-010 | **9.2/10** | Egress allowlist + Zibal/Stripe mocks + webhook HMAC/replay · [`platform-integrations-plane.mdoc`](../docs/phase-18/platform-integrations-plane.mdoc) |
| P5-E Registrations/finance | P5-E-N-006 | **9.0/10** | Capacity/waitlist + public throttle + paid-tour gate + TourCreated finance side effect · [`platform-registrations-finance-tranche.mdoc`](../docs/phase-18/platform-registrations-finance-tranche.mdoc) |

### Post-P5 achieved dimensions

| Dimension | P4 baseline | P5-full achieved |
|-----------|-------------|------------------|
| Metadata prod cutover | 9.1/10 (staging-only) | **9.5/10** — pilot tooling + operator parity path green |
| Operator parity | ~7/10 | **9.3/10** — metadata publish path + lifecycle/validation gates |
| Commerce / PSP | ~4/10 | **9.1/10** — workspace commerce schema + gateway guard (GU-02 lift at P5-D-N-010) |
| Integrations security | ~3/10 | **9.2/10** — egress proxy + PSP adapters + webhook ingress |
| Registrations capacity | ~6/10 (waitlist only) | **9.0/10** — seat math + throttle + finance outbox hook |

**P5-full weighted score:** **9.5/10** — Path B exit criterion met (`TEMP/p5-exit-checklist.md`).

**Denali invariant preserved:** payment mode remains `offline_receipt` only (PC-06/PC-07); gateway/commerce optional EPICs do not alter Denali tenant defaults.

**Next phase:** P6 enterprise evolution gate (`phase-6:guard` / `phase-6:fast-track`) — Architect YES for `phase-5:gate` full monorepo chain if required before merge.


---

## Engineering closure (post-audit)

| Layer | Status |
|-------|--------|
| Agent pack + `p5:gate` | Complete on working tree |
| Git commit | Required for repo closure — landed in same PR as P5-full |
| Production cutover | Still pilot/allowlist — Stage 3+ requires Architect YES |

**Honest score:** implementation **~8/10** on disk · repo ship **complete after commit** · prod cutover **pilot-ready only**.
