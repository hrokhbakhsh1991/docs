# P10 — Deprecated entrypoints

```yaml
doc_id: P10-DEPRECATED-ENTRYPOINTS
sole_entry: docs/phase-23/AGENT-START.md
fail_token: P10_FAIL
```

| Path / action | Use instead |
| ------------- | ----------- |
| `p10-production-grade-audit.md` alone | BOOT-MANIFEST + VERIFICATION-COMMANDS |
| `platform-production-grade.mdoc` alone | AGENT-START T0 |
| Bulk gap registry read | current nano only |
| `p10-effort-to-nine.md` for task pick | execution_order in BOOT-MANIFEST |
| Implement P9 guest dedup in P10 | P9 pack |
| Admin custom apex tenant_domains | trunk v2 — out of P10 exit |
| on_demand_tls day 1 | Wave C after wildcard |
| Deprecate Profile B IP | keep dual mode docs |
| health-check.sh 2/4 as done | smoke-four-process 4/4 |
| Full monorepo gate without YES | p10:gate + targeted smoke |

Boot deprecated path → `hollow_risk: flagged`.
