# P9 — Doc sync index

```yaml
doc_sync_id: P9-DOC-SYNC-INDEX
pack_version: "1.0"
nano_total: 13
sole_entry: AGENT-START.md
```

| Artifact | Role |
| -------- | ---- |
| [AGENT-START.md](AGENT-START.md) | Sole entry AI v1.0 |
| [appendices/P9-BOOT-MANIFEST.yaml](appendices/P9-BOOT-MANIFEST.yaml) | T0 boot |
| [appendices/P9-VERIFICATION-COMMANDS.yaml](appendices/P9-VERIFICATION-COMMANDS.yaml) | 13 nanos |
| [appendices/P9-ANTI-HOLLOW-CONTRACT.md](appendices/P9-ANTI-HOLLOW-CONTRACT.md) | No fake PASS |
| [p9-app-fit.md](p9-app-fit.md) | Scope |
| [p9-package-boundary.yaml](p9-package-boundary.yaml) | Edges |
| [p9-exit-checklist.md](p9-exit-checklist.md) | Exit |

## Nano map

| Nano | EPIC | Gaps |
| ---- | ---- | ---- |
| P9-0-N-001 | P9-0 | G-PKG-01 · G-BOOT-01/02/05/06 |
| P9-0-N-002 | P9-0 | G-AUTH-02/03 |
| P9-2-N-001 | P9-2 | G-BOOT-03 |
| P9-1-N-001 | P9-1 | G-SURF-01/04 · G-AUTH-01 |
| P9-1-N-002 | P9-1 | G-SURF-02 |
| P9-0-N-003 | P9-0 | G-BOOT-04 |
| P9-1-N-003 | P9-1 | G-SURF-03/05 · G-BOOT-08 |
| P9-1-N-004 | P9-1 | G-AUTH-04/05/06 |
| P9-0-N-006 | P9-0 | G-BOOT-07 |
| P9-3-N-001 | P9-3 | G-PKG-02 |
| P9-3-N-002 | P9-3 | G-SURF-06 |
| P9-3-N-003 | P9-3 | G-SURF-07 |
| P9-3-N-005 | P9-3 | gate |

## Gate

| Command | Token |
| ------- | ----- |
| `pnpm run p9:gate` | `P9_CODE_CONSOLIDATION_GATE_OK` |
