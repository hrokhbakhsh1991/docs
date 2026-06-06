# Phase 6 — Blockers

```yaml
updated: "2026-06-04"
```

| ID                        | Blocks                     | Condition                         | Waiver                                                                |
| ------------------------- | -------------------------- | --------------------------------- | --------------------------------------------------------------------- |
| **BLOCKER-P6-OUTBOX-5.4** | 6.4 full production parity | Phase 5.4 not VERIFIED_BEHAVIORAL | REQ-P6-028 stub + contract tests until green                          |
| **BLOCKER-P6-GATE-5**     | 6.0                        | `phase-5:gate` exit non-zero      | none                                                                  |
| **BLOCKER-P6-MINIO-ENV**  | 6.7 e2e in CI              | MinIO not in CI matrix            | SKIP documented in test; required for closure unless Architect waiver |

## Resolution commands

```bash
pnpm run phase-5:gate          # clears BLOCKER-P6-GATE-5
pnpm run phase-6:guard         # doc pack only
```
