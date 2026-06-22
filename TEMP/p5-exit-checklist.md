# P5 — Exit checklist

```yaml
phase: P5
version: 2.9-ai-friendly
status: complete
current_task: null
nano_total: 56
nano_done: 56
exit_core: P5-B-N-016
exit_full: P5-E-N-006
doc_sync: TEMP/p5/DOC-SYNC-INDEX.md
```

## Path A — P5-core (Denali customer — default)

- [x] P5-A complete (N-014)
- [x] phase-18 doc pack (N-002)
- [x] Gate hygiene covenant (N-001)
- [x] `metadataCutoverStage` in tenant detail DTO (N-003)
- [x] Super Admin cutover badge (N-004)
- [x] Staging pilot env checklist (N-005)
- [x] Metadata validation error counter (N-006)
- [x] Staging smoke bind script (N-007)
- [x] Rollback drill CO-05 (N-008)
- [x] Audit reuse AUD-01..02 (N-009)
- [x] Allowlist expand runbook DOC-03 (N-010)
- [x] G2 async ingress note DOC-04 (N-011)
- [x] FILE-MAP EPIC-A sync (N-012)
- [x] p5:gate flesh + web UI specs GATE-04..05 (N-013)
- [x] Parity matrix DOC-B-01 (N-001)
- [x] Nano↔gap map DOC-B-02 (N-002)
- [x] Publish gates LC-04..06 (N-004)
- [x] Draft vs publish VAL-01..03 (N-005)
- [x] Golden metadata RP-01..04 (N-006)
- [x] Form profile strip VAL-02b (N-007)
- [x] Catalog ref VAL-03 (N-008)
- [x] P5-B complete (N-016)
- [x] P5-C complete (N-010)
- [x] Preservation gate PC-01..10 contract (static)
- [x] Operator parity on metadata path (P5-B)
- [x] `pnpm run p5:gate` green (doc pack)
- [x] Enterprise assessment ≥ 9.2/10 post-core

## Path B — P5-full (optional — second customer)

- [x] Path A complete
- [x] P5-C commerce config (non-Denali)
- [x] P5-D integrations + egress
- [x] P5-E registrations tranche
- [x] Enterprise assessment ≥ 9.5/10
- [x] Engineering tree committed (git)

## Gate commands

```bash
pnpm run guard:import-boundary
pnpm run guard:p3-denali-covenant
pnpm run p5:gate
```
