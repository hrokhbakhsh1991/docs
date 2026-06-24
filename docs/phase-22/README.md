# Phase 22 — P9 Platform code consolidation

```yaml
phase: 22
pack: P9
pack_version: "1.0"
status: PLANNED
ai_agent_pack: COMPLETE
sole_entry: AGENT-START.md
prerequisite: P8 exit
exit_target: "8.7/10 composite (fit-aligned)"
```

> **AI v1.0:** Boot [AGENT-START.md](AGENT-START.md) → [P9-BOOT-MANIFEST.yaml](appendices/P9-BOOT-MANIFEST.yaml)

## Goal

M+P bootstrap یکجا · web بدون guest duplicate · boundary guards.

## Documents (agents)

| # | File | Role |
| - | ---- | ---- |
| **0** | [AGENT-START.md](AGENT-START.md) | Sole entry |
| 1 | [appendices/P9-BOOT-MANIFEST.yaml](appendices/P9-BOOT-MANIFEST.yaml) | T0 boot |
| 2 | [p9-app-fit.md](p9-app-fit.md) | Scope |
| 3 | [appendices/P9-VERIFICATION-COMMANDS.yaml](appendices/P9-VERIFICATION-COMMANDS.yaml) | 13 nanos |
| 4 | [appendices/P9-ANTI-HOLLOW-CONTRACT.md](appendices/P9-ANTI-HOLLOW-CONTRACT.md) | No skip |
| 5 | [DOC-SYNC-INDEX.md](DOC-SYNC-INDEX.md) | Index |
| 6 | [p9-exit-checklist.md](p9-exit-checklist.md) | Exit |

## In P9 vs not

| ✅ P9 | ❌ P8/P10 |
| ----- | --------- |
| guest-surface-host M+P | cookie rename (P8) |
| delete web public-auth | TLS (P10) |
| session-client web+portal | tenant_domains (P10) |
| **keep** catalog redirects | remove redirects |

## Gate

```bash
pnpm run p8:gate   # prerequisite
pnpm run p9:gate   # P9_CODE_CONSOLIDATION_GATE_OK
```
