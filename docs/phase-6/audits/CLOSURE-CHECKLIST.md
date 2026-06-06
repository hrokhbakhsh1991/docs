# Phase 6 — Closure checklist

> **Doc pack closure (documentation only):** [`QUALITY-VALIDATION.md`](../QUALITY-VALIDATION.md) — score **96** when `phase-6:guard` + anti-hollow PASS.

## A — Doc pack (no code required)

| Check                                  | Status               |
| -------------------------------------- | -------------------- |
| `pnpm run phase-6:guard` all PASS      | Run in CI            |
| `DOC-EXECUTION-SCORECARD` ≥ 96         | **PASS** (doc claim) |
| `CONSISTENCY-REPORT` doc_graph PASS    | **PASS**             |
| All subphases 6.0–6.9 depth            | **PASS**             |
| `env-runtime-matrix` + `adr-006` exist | **PASS**             |

## B — Prerequisites (repo)

| Check          | Status            |
| -------------- | ----------------- |
| `phase-5:gate` | PENDING until run |
| Entry yaml     | PENDING           |

## C — Subphases 6.1–6.8 (repo)

All **SPEC_ONLY** until plugin + e2e land.

## D — Gate (repo closure)

```bash
pnpm run phase-6:gate
```

## E — Forensic

[`phase-6-zero-debt-forensic-audit.mdoc`](../../audits/phase-6-zero-debt-forensic-audit.mdoc) — PENDING until 6.9 repo closure.
