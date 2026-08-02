# Phase 6 — Guards

| id                        | Role                                       |
| ------------------------- | ------------------------------------------ |
| `p6_boot_manifest`        | BOOT-MANIFEST.yaml exists                  |
| `p6_doc_hardening`        | PEK pack ≥96 (paths, subphases, scorecard) |
| `p6_denali_probe_honesty` | README states probe until 6.1              |
| `p6_anti_hollow`          | anti-hollow-contract + honest TRUTH        |
| `p6_gate_graph_residual`  | `phase-6:gate` = residual post-test + floors; forbids bare apps-cert and nested `phase-5:gate` |

Report metadata (`reports/phase-6-gate-*.json`): `appsCertMode: residual`, `fullAppsCert: false`, `appsCertOwned: [post-test, floors]`.

Perf baseline capture template (empty until measured): [`appendices/residual-apps-cert-perf-baseline.md`](appendices/residual-apps-cert-perf-baseline.md).

```bash
pnpm run phase-6:guard
node scripts/guards/lib/anti-hollow-phase6.mjs
node scripts/guards/lib/phase-6-doc-hardening.mjs
node scripts/guards/lib/phase-6-gate-graph.mjs
```

**Doc execution system target:** **96** — [`audits/DOC-EXECUTION-SCORECARD.md`](audits/DOC-EXECUTION-SCORECARD.md).
