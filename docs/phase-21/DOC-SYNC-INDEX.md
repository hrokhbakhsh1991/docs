# P8 — Doc sync index

```yaml
doc_sync_id: P8-DOC-SYNC-INDEX
pack_version: "1.0"
nano_total: 14
sole_entry: AGENT-START.md
```

| Artifact | Role | Version |
| -------- | ---- | ------- |
| [AGENT-START.md](AGENT-START.md) | Sole human/agent entry | 1.0 AI |
| [appendices/P8-BOOT-MANIFEST.yaml](appendices/P8-BOOT-MANIFEST.yaml) | T0 boot | 1.0 |
| [appendices/P8-ANTI-HOLLOW-CONTRACT.md](appendices/P8-ANTI-HOLLOW-CONTRACT.md) | Proof tiers | 1.0 |
| [appendices/P8-VERIFICATION-COMMANDS.yaml](appendices/P8-VERIFICATION-COMMANDS.yaml) | 14 nano commands | 1.0 |
| [appendices/P8-AGENT-TURN-SCHEMA.md](appendices/P8-AGENT-TURN-SCHEMA.md) | Mandatory turn_report | 1.0 |
| [appendices/P8-IMPLEMENTATION-TRUTH.md](appendices/P8-IMPLEMENTATION-TRUTH.md) | Honest status | 1.0 |
| [appendices/P8-EXECUTION-DISCIPLINE.md](appendices/P8-EXECUTION-DISCIPLINE.md) | No skip / no leak | 1.0 |
| [appendices/P8-DEPRECATED-ENTRYPOINTS.md](appendices/P8-DEPRECATED-ENTRYPOINTS.md) | Wrong boot paths | 1.0 |
| [p8-app-fit.md](p8-app-fit.md) | Scope fit | 1.0 |
| [p8-gap-registry.md](p8-gap-registry.md) | G-* owners | 1.2 |
| [p8-exit-checklist.md](p8-exit-checklist.md) | Exit | 1.2 |
| [p8-action-plan.yaml](p8-action-plan.yaml) | Waves | 1.1 |

## Nano → gap map

| Nano | Gaps |
| ---- | ---- |
| P8-0-N-001 | G-ING-01 |
| P8-0-N-002 | G-ING-02 |
| P8-0-N-003 | G-ING-04a |
| P8-0-N-004 | G-ING-05a |
| P8-0-N-005 | G-ING-03 |
| P8-1-N-001 | G-SES-01, G-SES-02 |
| P8-1-N-002 | G-SES-03, G-SES-05 |
| P8-1-N-003 | G-SES-04 |
| P8-1-N-004 | G-SES-06 |
| P8-2-N-001 | G-ENV-01, G-ENV-02 |
| P8-2-N-002 | G-ENV-03 |
| P8-2-N-004 | G-ENV-04 |
| P8-3-N-001 | gate |
| P8-3-N-002 | CI verify |

## Gate scripts

| Script | Token |
| ------ | ----- |
| `pnpm run p8:gate` | `P8_PLATFORM_SURFACE_GATE_OK` |
| `pnpm run p7:gate` | prerequisite |
| `scripts/p8-platform-surface-gate.sh` | impl |

## References

- [../POST-P7-PACK-ALIGNMENT.md](../POST-P7-PACK-ALIGNMENT.md)
