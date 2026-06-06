# Phase 6 — Blockers

```yaml
updated: "2026-06-07"
```

| ID                        | Blocks                     | Condition                         | Waiver                                                      |
| ------------------------- | -------------------------- | --------------------------------- | ----------------------------------------------------------- |
| **BLOCKER-P6-OUTBOX-5.4** | 6.4 full production parity | Phase 5.4 not VERIFIED_BEHAVIORAL | REQ-P6-028 stub + contract tests until green                |
| **BLOCKER-P6-GATE-5**     | 6.0                        | `phase-5:gate` exit non-zero      | none                                                        |
| **BLOCKER-P6-MINIO-ENV**  | —                          | Cleared 2026-06-07                | CI job `minio-photo` in `phase-6-gate.yml` · local 4/4 PASS |

## Resolution commands

```bash
pnpm run phase-5:gate          # clears BLOCKER-P6-GATE-5
pnpm run phase-6:guard         # doc pack only
```
