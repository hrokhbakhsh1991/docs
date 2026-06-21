# P5 — Exit checklist

```yaml
phase: P5
version: 2.9-ai-friendly
status: in_progress
current_task: P5-A-N-004
nano_total: 56
nano_done: 3
exit_core: P5-B-N-016
exit_full: P5-E-N-006
doc_sync: TEMP/p5/DOC-SYNC-INDEX.md
```

## Path A — P5-core (Denali customer — default)

- [ ] P5-A complete (N-014)
- [x] phase-18 doc pack (N-002)
- [x] Gate hygiene covenant (N-001)
- [x] `metadataCutoverStage` in tenant detail DTO (N-003)
- [ ] Staging metadata pilot smoke script (N-007)
- [ ] P5-B complete (N-016)
- [x] Preservation gate PC-01..10 contract (static)
- [ ] Operator parity on metadata path (P5-B)
- [x] `pnpm run p5:gate` green (doc pack)
- [ ] Enterprise assessment ≥ 9.2/10 post-core

## Path B — P5-full (optional — second customer)

- [ ] Path A complete
- [ ] P5-C commerce config (non-Denali)
- [ ] P5-D integrations + egress
- [ ] P5-E registrations tranche
- [ ] Enterprise assessment ≥ 9.5/10

## Gate commands

```bash
pnpm run guard:import-boundary
pnpm run guard:p3-denali-covenant
pnpm run p5:gate
```
