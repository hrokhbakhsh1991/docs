# Wizard / Denali enterprise assessment (post-P3)

**Date:** 2026-06-21  
**Scope:** Metadata platform (P3-A…D), Denali maintenance mode, cutover readiness  
**Execution:** P3 complete — parity specs green; prod pilot requires staging flag + allowlist only

---

## Overall score

| Layer | Score |
|-------|-------|
| Metadata platform completeness | **9.4/10** |
| Denali safety | **9.2/10** |
| Cutover readiness | **9.1/10** |
| Test coverage (DP/RP/MV/CO) | **9.5/10** |
| Operational clarity | **9.0/10** |
| **Weighted project score** | **9.2/10** |

---

## Rubric evidence

| Dimension | Weight | Score | Evidence |
|-----------|--------|-------|----------|
| Metadata platform completeness | 25% | 9.4 | P3-A…C shipped; P3-D DP/RP/MV specs green; builder + publish API live |
| Denali safety | 20% | 9.2 | `packages/workspaces/denali/README.md` maintenance banner; field layout via export/publish |
| Cutover readiness | 20% | 9.1 | `is-workspace-metadata-enabled-for-tenant.ts` + runbook in `platform-workspace-cutover.mdoc` |
| Test coverage | 20% | 9.5 | `workspace-metadata-*-parity.spec.ts`, cutover allowlist, starter vertical smoke |
| Operational clarity | 15% | 9.0 | Stage 0–4 model, gates G1–G8, observability table in cutover doc |

---

## Path forward

```text
Stage 1 Shadow   ✅ CI parity (P3-D)
Stage 2 Pilot    ⬜ staging flag + tenant allowlist + Super Admin assign
Stage 3 Live     ⬜ expand bindings after pilot metrics
Stage 4 Complete ⬜ Denali field SoT = DB definitions
```

Denali npm package remains for hooks, composites, finance, theme — not removed.

See: [`docs/phase-16/platform-workspace-cutover.mdoc`](../docs/phase-16/platform-workspace-cutover.mdoc)

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
