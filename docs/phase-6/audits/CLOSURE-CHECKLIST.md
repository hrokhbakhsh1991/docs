# Phase 6 — Closure checklist

> **Doc pack closure (documentation only):** [`QUALITY-VALIDATION.md`](../QUALITY-VALIDATION.md) — score **96** when `phase-6:guard` + anti-hollow PASS.

## A — Doc pack (no code required)

| Check                                  | Status                |
| -------------------------------------- | --------------------- |
| `pnpm run phase-6:guard` all PASS      | **PASS** (2026-06-06) |
| `DOC-EXECUTION-SCORECARD` ≥ 96         | **PASS** (doc claim)  |
| `CONSISTENCY-REPORT` doc_graph PASS    | **PASS**              |
| All subphases 6.0–6.9 depth            | **PASS**              |
| `env-runtime-matrix` + `adr-006` exist | **PASS**              |

## B — Prerequisites (repo)

| Check            | Status                                                        |
| ---------------- | ------------------------------------------------------------- |
| `phase-5:guard`  | **PASS** (`reports/phase-5-gate-2026-06-06.json`)             |
| Phase 4 artifact | **PASS** (`phase-4-resilience-regression-gate.last-run.json`) |
| Entry yaml       | VERIFIED (`phase-6-entry-verified.yaml`)                      |

## C — Subphases 6.1–6.9 (repo)

**6.1–6.9 VERIFIED_BEHAVIORAL** · `phase_closed: true` in IMPLEMENTATION-TRUTH.

## D — Gate (repo closure)

**Fast-track (local closure 2026-06-06):**

```bash
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
export STORAGE_DRIVER=prisma NODE_ENV=test
pnpm run phase-6:fast-closure
```

Full nested gate (CI / nightly):

```bash
pnpm run phase-6:gate
```

## E — Forensic

[`phase-6-zero-debt-forensic-audit.mdoc`](../../audits/phase-6-zero-debt-forensic-audit.mdoc) · [`reports/phase-6-forensic-audit-2026-06-06.md`](../../../reports/phase-6-forensic-audit-2026-06-06.md) — **CLOSURE_PASS_FAST_TRACK** · purity **9.5**.

## Residual waivers (honesty)

| Item                              | Status                                         |
| --------------------------------- | ---------------------------------------------- |
| MinIO round-trip                  | **PASS** (`pnpm run test:minio-photo` 4/4)     |
| Playwright `denali-wizard`        | **PASS** (`test:smoke:denali` 4/4, 2026-06-06) |
| BLOCKER-P6-OUTBOX-5.4             | Finance stub per REQ-P6-028                    |
| Full `phase-6:gate` 4× test chain | Deferred to CI nightly                         |
