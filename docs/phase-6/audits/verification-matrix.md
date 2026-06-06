# Phase 6 — Verification matrix

> **Truth ledger:** [`IMPLEMENTATION-TRUTH.md`](IMPLEMENTATION-TRUTH.md) — rows are targets until repo VERIFIED.  
> **SOURCE OF TRUTH:** REQ-P6-\* ↔ actions ↔ subphases  
> **Subphase map:** [`subphase-enforcement-map.md`](subphase-enforcement-map.md)  
> **Tests:** [`../appendices/test-inventory.md`](../appendices/test-inventory.md) · **Industry:** [`../appendices/industry-alignment-2026.md`](../appendices/industry-alignment-2026.md)

| Requirement ID | Requirement                          | Validation Method       | Evidence                                                                        | Pass Condition                                         |
| -------------- | ------------------------------------ | ----------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| REQ-P6-001     | phase-5:gate exit 0                  | `pnpm run phase-5:gate` | terminal + `reports/phase-6-entry-verified.yaml`                                | exit_code == 0                                         |
| REQ-P6-002     | phase_6_entry yaml complete          | file audit P6-0-A02     | `reports/phase-6-entry-verified.yaml`                                           | all required fields PASS                               |
| REQ-P6-003     | no DENALI\_\* in apps/api core       | depcruise P6-0-A03      | `guard:import-boundary` / custom rule                                           | zero violations                                        |
| REQ-P6-004     | denali package exports plugin        | build P6-1-A01          | `packages/workspaces/denali`                                                    | `getDenaliWorkspacePlugin` exported                    |
| REQ-P6-005     | plugin contract manifest guard       | P6-1-A02                | `phase-6.contract.spec.ts` (scaffold→behavioral)                                | spec pass                                              |
| REQ-P6-006     | registry parity vs legacy domain     | P6-2-A03                | `registry-parity.spec.ts`                                                       | fixture diff empty                                     |
| REQ-P6-007     | validateCanonical Denali fixtures    | P6-2-A04                | api/plugin unit tests                                                           | FAIL closed on bad canonical                           |
| REQ-P6-008     | ACL-only legacy shape mapping        | P6-2-A02                | grep `src/acl/` boundary                                                        | no legacy types outside acl                            |
| REQ-P6-009     | codegen CI dirty check               | P6-2-A05                | `pnpm run denali:codegen` + git diff                                            | generated/ clean                                       |
| REQ-P6-010     | widgets + theme ingress              | P6-3-A02                | composites.contract.spec.ts + phase-2:gate                                      | renderer from platform-core only                       |
| REQ-P6-011     | finance handlers in plugin only      | P6-4-A01                | package tree audit                                                              | no `apps/api/modules/finance` expansion                |
| REQ-P6-012     | finance tenant mismatch idempotency  | P6-4-A03                | port legacy spec pattern                                                        | throws FINANCE_LEDGER_TENANT_MISMATCH                  |
| REQ-P6-013     | API resolves denali plugin           | P6-5-A01                | `denali-workspace-plugin.spec.ts`                                               | create tour denali workspace_type                      |
| REQ-P6-014     | web lazy-loads denali module         | P6-5-A02                | `pnpm --filter @apps/web build` + chunk grep · denali-workspace-plugin web case | no starter fallback when tenant denali                 |
| REQ-P6-015     | smoke parity golden fixtures         | P6-6-A02                | Playwright tests/smoke/denali-wizard.spec.ts · SMK-P6-01..06                    | all scenarios PASS                                     |
| REQ-P6-016     | MinIO tenant-prefixed keys           | P6-7-A02                | `minio-photo.spec.ts`                                                           | upload+read scoped                                     |
| REQ-P6-017     | migrateCanonical no dual-write       | P6-8-A03                | migration integration                                                           | single SoT canonical_data                              |
| REQ-P6-018     | phase-6.contract.spec behavioral     | P6-9-A02                | `packages/workspaces/denali/test/`                                              | all pass at closure                                    |
| REQ-P6-019     | forensic Purity ≥ 8                  | P6-9-A04                | `reports/phase-6-forensic-audit-*.md`                                           | score >= 8                                             |
| REQ-P6-020     | no legacy runtime import             | P6-0-A04 + depcruise    | trunk apps                                                                      | zero `legacy/` imports                                 |
| REQ-P6-021     | platform-core unchanged for Denali   | PR review P6-F-003      | diff scope                                                                      | no Denali-only core PR                                 |
| REQ-P6-022     | phase-6:gate defined and green       | P6-9-A01                | `pnpm run phase-6:gate`                                                         | exit 0                                                 |
| REQ-P6-023     | golden canonical fixtures versioned  | P6-6-A01                | `test/fixtures/golden/*.json`                                                   | files exist + snapshotted                              |
| REQ-P6-024     | shadow validate non-prod only        | P6-5-A03                | env guard test                                                                  | disabled when NODE_ENV=production                      |
| REQ-P6-025     | starter remains default dev tenant   | P6-0-A05                | resolve spec                                                                    | starter still green                                    |
| REQ-P6-026     | workspace-sdk denali binding         | P6-5-A04                | `denali-workspace-binding.contract.spec.ts`                                     | resolveWorkspacePluginIdForType("denali") === "denali" |
| REQ-P6-027     | probe replaced — README honesty      | P6-1-A03                | denali README                                                                   | product workspace documented                           |
| REQ-P6-028     | outbox consumer stub until 5.4 green | P6-4-A04                | contract test w/ stub                                                           | documented BLOCKER if 5.4 open                         |
| REQ-P6-029     | Big-O on Denali hot paths            | P6-9-A03                | doc in subphase 6.6/6.2                                                         | indexed list paths only                                |
| REQ-P6-030     | doc truth §18 parity                 | P6-9-A05                | verification-matrix audit                                                       | 1:1 claim vs test                                      |

---

## Repo evidence index (targets)

| Subphase | Behavioral evidence (when VERIFIED)                               |
| -------- | ----------------------------------------------------------------- |
| 6.1      | `packages/workspaces/denali/src/denali.plugin.ts`                 |
| 6.2      | `packages/workspaces/denali/test/registry-parity.spec.ts`         |
| 6.4      | `packages/workspaces/denali/test/finance-outbox-consumer.spec.ts` |
| 6.5      | `apps/api/test/denali-workspace-plugin.spec.ts`                   |
| 6.6      | smoke / Playwright suite                                          |
| 6.7      | `apps/api/test/minio-photo.spec.ts`                               |
| 6.8      | `apps/api/test/migrate-canonical-denali.spec.ts`                  |
| 6.9      | `reports/phase-6-gate-*.json` + forensic report                   |

**Scaffold honesty:** REQ-P6-005 / REQ-P6-018 may start as **VERIFIED_SCAFFOLD** until HTTP e2e proves 6.5–6.6.
