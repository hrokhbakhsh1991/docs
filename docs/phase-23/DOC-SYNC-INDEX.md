# P10 — Doc sync index

```yaml
doc_sync_id: P10-DOC-SYNC-INDEX
pack_version: "1.0"
nano_total: 16
sole_entry: AGENT-START.md
```

| Artifact | Role |
| -------- | ---- |
| [AGENT-START.md](AGENT-START.md) | Sole entry AI v1.0 |
| [appendices/P10-BOOT-MANIFEST.yaml](appendices/P10-BOOT-MANIFEST.yaml) | T0 boot |
| [appendices/P10-VERIFICATION-COMMANDS.yaml](appendices/P10-VERIFICATION-COMMANDS.yaml) | 16 nanos |
| [appendices/P10-ANTI-HOLLOW-CONTRACT.md](appendices/P10-ANTI-HOLLOW-CONTRACT.md) | No fake PASS |
| [p10-app-fit.md](p10-app-fit.md) | Scope |
| [p10-production-profile.yaml](p10-production-profile.yaml) | Profile C contract |
| [p10-exit-checklist.md](p10-exit-checklist.md) | Exit |

## Nano map

| Nano | EPIC | Gaps |
| ---- | ---- | ---- |
| P10-1-N-001 | P10-1 | G-TLS-01/02/04/09 |
| P10-2-N-001 | P10-2 | G-DEP-01/09 |
| P10-2-N-002 | P10-2 | G-DEP-02 |
| P10-3-N-001 | P10-3 | G-OPS-01 |
| P10-2-N-003 | P10-2 | G-DEP-03 |
| P10-2-N-004 | P10-2 | G-DEP-04/05 |
| P10-2-N-005 | P10-2 | G-DEP-06 |
| P10-1-N-002 | P10-1 | G-TLS-05/07 |
| P10-3-N-002 | P10-3 | G-TLS-06 · G-OPS-04 |
| P10-3-N-003 | P10-3 | G-DEP-10 |
| P10-0-N-001 | P10-0 | G-DOM-02 |
| P10-0-N-002 | P10-0 | G-TLS-03/10 |
| P10-0-N-003 | P10-0 | G-DOM-04 |
| P10-2-N-006 | P10-2 | G-DOM-05 |
| P10-3-N-005 | P10-3 | G-DEP-08 |
| P10-3-N-006 | P10-3 | gate |

## Gate

| Command | Token |
| ------- | ----- |
| `pnpm run p10:gate` | `P10_PRODUCTION_GRADE_GATE_OK` |

Prerequisite: `pnpm run p9:gate` → `P9_CODE_CONSOLIDATION_GATE_OK`
