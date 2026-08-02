# Phase 6 — residual apps-cert performance baseline (template)

```yaml
purpose: Capture wall-clock before/after residual migration measurements
rule: Do not invent timings — fill only after a real local or CI run
status: TEMPLATE_EMPTY
related_gate: phase-6:gate
apps_cert_mode: residual
```

## Scope

Measure **only** the residual apps-cert slice inside `phase-6:gate` (not full historical 0–5 nest):

1. `PHASE_3_APPS_CERT_INHERIT_ROOT=1 pnpm run phase-3:apps-cert:post-test`
2. `PHASE_3_APPS_CERT_INHERIT_ROOT=1 pnpm run phase-3:apps-cert:floors`

Optional comparator (standalone; **not** required for phase-6 PASS):

- `pnpm run phase-3:apps-cert` (full leaf certification)

## Capture rules

- Record wall clock from process start to exit (same machine / same CI class when comparing).
- Note Node version (`.nvmrc`), whether caches were warm, and Postgres availability (runtime-proof precedes residual in the full gate).
- Leave cells blank until measured. **Never** paste estimated or invented numbers.
- Attach report paths when available (`reports/phase-3-apps-cert-post-test-*.json`, `reports/phase-3-apps-cert-floors-*.json`).

## Before / after template

| Slice | Environment | Commit / SHA | Started (UTC) | Ended (UTC) | Duration | Notes / report path |
| --- | --- | --- | --- | --- | --- | --- |
| Full `phase-3:apps-cert` (pre-migration baseline) | _TBD_ | _TBD_ | | | | |
| Residual `post-test` | _TBD_ | _TBD_ | | | | |
| Residual `floors` | _TBD_ | _TBD_ | | | | |
| Residual sum (`post-test` + `floors`) | _TBD_ | _TBD_ | | | | |
| Full `phase-6:gate` (optional envelope) | _TBD_ | _TBD_ | | | | |

## Delta (fill after both columns exist)

| Comparison | Baseline duration | Residual duration | Delta | Filled by |
| --- | --- | --- | --- | --- |
| Full apps-cert vs residual sum | | | | |
| Full phase-6 envelope (if captured) | | | | |

## Anti-hollow

| Claim | Truth |
| --- | --- |
| Template present | Does **not** prove a speed win |
| Empty duration cells | Expected until a real capture run |
| phase-6 residual PASS | Independent of this baseline table |

See [`phase-3-guard-apps-cert-split.mdoc`](../../phase-3/phase-3-guard-apps-cert-split.mdoc) and [`req-p6-command-atlas.md`](./req-p6-command-atlas.md).
