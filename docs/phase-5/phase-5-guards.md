# Phase 5 — Guards

> **SOURCE OF TRUTH (rule text):** [`phase-5-enforcement.md`](phase-5-enforcement.md) RULE-001–RULE-040  
> **Forbidden:** [`phase-5-enforcement.md`](phase-5-enforcement.md#forbidden-actions) FORBIDDEN-001–030  
> **CI scripts:** [`ci.md`](ci.md) · **Guard script:** `scripts/guards/phase-5-guard.mjs`

## p5\_\* guard checks

| id                              | REQ / DEL                        | Command / verify                                                               |
| ------------------------------- | -------------------------------- | ------------------------------------------------------------------------------ |
| `p5_boot_manifest`              | BOOT-MANIFEST                    | `docs/phase-5/appendices/BOOT-MANIFEST.yaml` exists                            |
| `p5_deprecated_registry`        | DEPRECATED                       | `docs/phase-5/appendices/DEPRECATED-ENTRYPOINTS.md` exists                     |
| `p5_canonical_schema_doc`       | DEL-P5-001                       | `docs/phase-5-canonical-schema.md` exists                                      |
| `p5_sql_migration`              | MAP 5.1                          | `infra/sql/002_phase5_data_layer.sql`                                          |
| `p5_prisma_models`              | REQ-P5-007                       | Prisma `OutboxEvent`, `AuditEvent`, `canonical_data`                           |
| `p5_with_canonical_transaction` | DEL-P5-001 §7                    | `with-canonical-transaction.ts`                                                |
| `p5_contract_spec`              | REQ-P5-024                       | `pnpm --filter @apps/api run test:phase-5` (**SCAFFOLD** — see test-inventory) |
| `p5_anti_hollow`                | anti-hollow                      | `lib/anti-hollow-phase5.mjs`                                                   |
| `p5_doc_hardening`              | DOC score >= 95                  | `lib/phase-5-doc-hardening.mjs`                                                |
| `p5_repo_alignment`             | Docs ↔ enterprise tenant repo    | `lib/phase-5-repo-alignment.mjs`                                               |
| `p5_cross_phase_continuity`     | Phases 0–5 doc links + entry map | `lib/phase-cross-continuity.mjs`                                               |

## Runbook (after doc or apps/api changes)

```bash
nvm use   # Node 24 required
pnpm run phase-5:guard
# Before 5.6 closure also:
pnpm run phase-4:gate
pnpm run phase-5:gate   # full chain — not guard alone
```

`p5_doc_hardening` also enforces: [`IMPLEMENTATION-DECISIONS.md`](appendices/IMPLEMENTATION-DECISIONS.md), single boot (no layer4 execute), skeleton FORBIDDEN banners, entry yaml `verified_at`, forensic mdoc `auto_fill: false`, overview Phase 6–7 out-of-scope, `OUTBOX_RELAY_ENABLED` in env matrix.

## Scaffold vs behavioral

```yaml
phase_5_guard_pass:
  proves: [DEL-P5-001 files, prisma models, TX helper, contract existence test]
  does_not_prove: [5.3 projection sync, 5.4 outbox relay, 5.5 audit writes]
behavioral_guards:
  RULE-003_005: apps/api/test/canonical-validate-before-persist.spec.ts # 5.2 VERIFIED
  RULE-008: pending 5.3
  RULE-012_013: pending 5.4
```

Full behavioral proof map: [`appendices/IMPLEMENTATION-MAP.md`](appendices/IMPLEMENTATION-MAP.md)

## Architectural guards

| Guard                         | RULE IDs                    | Enforce                       |
| ----------------------------- | --------------------------- | ----------------------------- |
| Canonical JSONB SoT           | RULE-001, RULE-002          | migration + integration       |
| Single write path             | RULE-006, P5-X-A01          | depcruise / contract          |
| No platform event sourcing    | RULE-023, FORBIDDEN-001     | schema review                 |
| No separate CQRS DB           | RULE-024, FORBIDDEN-002     | config review                 |
| No CDC/Kafka required         | RULE-025, FORBIDDEN-003,004 | infra review                  |
| Projections sync with write   | RULE-008, RULE-009          | integration + DEL-P5-009      |
| No JSONB @> list hot path     | RULE-010, FORBIDDEN-016     | EXPLAIN + adversarial         |
| platform-core ↛ tenant-kernel | RULE-038, FORBIDDEN-023     | `pnpm run guard:architecture` |

## Dependency guards

| Guard                   | RULE IDs                        | Enforce                 |
| ----------------------- | ------------------------------- | ----------------------- |
| Phase 4 gate before 5.1 | RULE-034, FORBIDDEN-018         | `pnpm run phase-4:gate` |
| DEL-P5-001 before DDL   | TG-P5-004, BLOCKER-P5-001       | file exists             |
| Prisma TX tour+outbox   | RULE-013                        | integration             |
| No Denali/MinIO/silo    | RULE-026–028, FORBIDDEN-008–012 | depcruise + PR scope    |

## Security guards

| Guard                             | RULE IDs                          | Enforce                                                                                                                   |
| --------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| tenant_id on tours/outbox         | RULE-004, RULE-011                | DDL NOT NULL                                                                                                              |
| RLS new tables                    | RULE-019                          | rls-isolation extended                                                                                                    |
| withTenantTransaction             | RULE-020, FORBIDDEN-020           | lint / contract                                                                                                           |
| CASL + RLS both                   | RULE-021, RULE-022, FORBIDDEN-021 | unit + integration                                                                                                        |
| Tenant injection / pool pollution | RULE-019, RULE-021                | `test/0-security/tenant-injection.spec.ts` + [TENANT-INJECTION-PENTEST-REPORT](audits/TENANT-INJECTION-PENTEST-REPORT.md) |
| Cross-tenant events forbidden     | RULE-014, FORBIDDEN-022           | platform-events test                                                                                                      |
| Tenant-scoped jobs                | RULE-040, FORBIDDEN-019           | job contract when added                                                                                                   |

## Execution guards

| Guard                      | RULE IDs                | Enforce                    |
| -------------------------- | ----------------------- | -------------------------- |
| validate before TX         | RULE-003                | ordering test P5-2-A02/A03 |
| No publish before commit   | RULE-012, FORBIDDEN-005 | P5-4-A03                   |
| Outbox SKIP LOCKED relay   | RULE-015                | P5-4-A06                   |
| Idempotent handlers        | RULE-016, P5-X-A12      | P5-4-A07                   |
| OUTBOX_ENABLED fail-closed | RULE-017, RULE-018      | P5-4-A10                   |

## Validation guards

| Guard             | REQ / action                 | Enforce                  |
| ----------------- | ---------------------------- | ------------------------ |
| Entry gate        | REQ-P5-001–006               | P5-0-A\*                 |
| MAP 5.1–5.5       | REQ-P5-007–023               | subphase actions         |
| Contract spec     | RULE-031, REQ-P5-024         | phase-5.contract.spec.ts |
| Adversarial P0/P1 | REQ-P5-025                   | P5-6-A02                 |
| Big-O / O(N)      | RULE-032,033, REQ-P5-026,027 | P5-6-A03/A04             |
| Forensic purity   | REQ-P5-028                   | P5-6-A05                 |

## Drift prevention

```yaml
drift_prevention:
  grep_only_closure: FORBIDDEN-017 — RULE-031
  schema_without_db: FORBIDDEN-026 — MAP hardening filter
  in_process_only_bus: FORBIDDEN-006 — RULE-017
  architecture_redesign: FORBIDDEN-030
  forensic_drift: MIGRATION-MAP.md §14.3 — label forensic-drift on guard weaken
```

**Depends on:** [`phase-5-enforcement.md`](phase-5-enforcement.md) · **Validated by:** [`audits/verification-matrix.md`](audits/verification-matrix.md)
