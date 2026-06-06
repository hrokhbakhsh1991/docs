# Phase 5 — Implementation map (doc ↔ repo)

```yaml
map_meta:
  date: "2026-06-04"
  truth_ledger: ../audits/IMPLEMENTATION-TRUTH.md
  rule: "Status here mirrors IMPLEMENTATION-TRUTH — update both on subphase completion"
```

> **Agents:** Use this file to find **where code lives** without loading layer4 or research.  
> **Project alignment:** [`REPO-PROJECT-ALIGNMENT.md`](REPO-PROJECT-ALIGNMENT.md) · guard `p5_repo_alignment`

## Doc update on completion

```yaml
on_subphase_complete:
  - update ../audits/IMPLEMENTATION-TRUTH.md (same status enum)
  - update this file §N + subphase table above
  - register test in test-inventory.md (IMPLEMENTED row)
  - pnpm run phase-5:guard
forbidden: VERIFIED_BEHAVIORAL without green test file
```

## Subphase status

| Subphase | Status              | Layer      | Primary repo paths                                                                                                                                                                                                                                                                                                                                                               |
| -------- | ------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **5.0**  | VERIFIED_SCAFFOLD   | entry      | [`reports/phase-5-entry-verified.yaml`](../../../reports/phase-5-entry-verified.yaml) · [`CROSS-PHASE-ENTRY-MAP.md`](CROSS-PHASE-ENTRY-MAP.md)                                                                                                                                                                                                                                   |
| **5.1**  | VERIFIED_SCAFFOLD   | scaffold   | [`docs/phase-5-canonical-schema.md`](../../phase-5-canonical-schema.md) · [`infra/sql/002_phase5_data_layer.sql`](../../../infra/sql/002_phase5_data_layer.sql) · [`apps/api/prisma/schema.prisma`](../../../apps/api/prisma/schema.prisma) (`Tour.canonical` → DB `canonical_data`) · [`with-canonical-transaction.ts`](../../../apps/api/src/db/with-canonical-transaction.ts) |
| **5.2**  | VERIFIED_BEHAVIORAL | behavioral | See **§5.2** below                                                                                                                                                                                                                                                                                                                                                               |
| **5.3**  | VERIFIED_BEHAVIORAL | behavioral | `projection-sync.ts` + atomic TX — **§5.3 + §5.4-S1**                                                                                                                                                                                                                                                                                                                            |
| **5.4**  | VERIFIED_BEHAVIORAL | behavioral | **S1–S4** atomic + stress + relay + idempotency                                                                                                                                                                                                                                                                                                                                  |
| **5.5**  | VERIFIED_BEHAVIORAL | behavioral | `audit-logger.ts` · append-only trigger · `5.5-audit-events.spec.ts`                                                                                                                                                                                                                                                                                                             |
| **5.6**  | PARTIAL             | gate       | [`scripts/guards/phase-5-guard.mjs`](../../../scripts/guards/phase-5-guard.mjs) · full [`phase-5:gate`](../../../package.json)                                                                                                                                                                                                                                                   |

## §5.2 — Validate-before-persist (VERIFIED)

| Concern                             | File                                                                                                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pipeline spec                       | [`phase-5-canonical-schema.md`](../../phase-5-canonical-schema.md) §4.1                                                                                                                                    |
| Workspace type                      | [`apps/api/src/tenant/resolve-workspace-type.ts`](../../../apps/api/src/tenant/resolve-workspace-type.ts)                                                                                                  |
| Plugin registry                     | [`apps/api/src/workspace/resolve-workspace-plugin.ts`](../../../apps/api/src/workspace/resolve-workspace-plugin.ts)                                                                                        |
| Validation                          | [`apps/api/src/tours/canonical-validation.ts`](../../../apps/api/src/tours/canonical-validation.ts)                                                                                                        |
| Pre-TX gate                         | [`apps/api/src/canonical/pre-transaction-validation.ts`](../../../apps/api/src/canonical/pre-transaction-validation.ts) · [`validation-failure.ts`](../../../apps/api/src/canonical/validation-failure.ts) |
| TX gate consumer                    | [`apps/api/src/db/with-canonical-transaction.ts`](../../../apps/api/src/db/with-canonical-transaction.ts)                                                                                                  |
| Write orchestration                 | [`apps/api/src/tours/tours.service.ts`](../../../apps/api/src/tours/tours.service.ts) → [`canonical-tour.service.ts`](../../../apps/api/src/canonical/canonical-tour.service.ts)                           |
| migrateCanonical hook (design only) | [`apps/api/src/canonical/migrate-canonical-hook.ts`](../../../apps/api/src/canonical/migrate-canonical-hook.ts)                                                                                            |
| HTTP 400 mapping                    | [`apps/api/src/tours/tours.routes.ts`](../../../apps/api/src/tours/tours.routes.ts)                                                                                                                        |

### Tests (behavioral)

| Test                                                                                                                          | Proves                                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`apps/api/test/5.2-plugin-validation.spec.ts`](../../../apps/api/test/5.2-plugin-validation.spec.ts)                         | Postgres: invalid → 0 `tours` + 0 `outbox_events`; TX gate |
| [`apps/api/test/canonical-validate-before-persist.spec.ts`](../../../apps/api/test/canonical-validate-before-persist.spec.ts) | Invalid canonical → 400, no row                            |
| [`apps/api/test/validate-before-persist-ordering.spec.ts`](../../../apps/api/test/validate-before-persist-ordering.spec.ts)   | `createTour` not called when validation fails              |
| [`apps/api/src/workspace/resolve-workspace-plugin.spec.ts`](../../../apps/api/src/workspace/resolve-workspace-plugin.spec.ts) | `starter` OK · `denali` → NOT_BOUND                        |

```bash
pnpm --filter @apps/api test
# or targeted:
NODE_ENV=test node --import tsx --test \
  apps/api/test/canonical-validate-before-persist.spec.ts \
  apps/api/test/validate-before-persist-ordering.spec.ts
```

## §5.3 + §5.4-S1 — Projections + atomic outbox (VERIFIED)

> **SoT:** DEC-003 + DEC-004 · **Single TX:** [`atomic-canonical-tour-persist.ts`](../../../apps/api/src/canonical/atomic-canonical-tour-persist.ts)

| Concern        | File                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Projections    | [`projection-sync.ts`](../../../apps/api/src/canonical/projection-sync.ts) — `tours.title`, `tours.schema_version`                |
| Atomic persist | [`atomic-canonical-tour-persist.ts`](../../../apps/api/src/canonical/atomic-canonical-tour-persist.ts)                            |
| Outbox enqueue | [`enqueue-domain-event.ts`](../../../apps/api/src/outbox/enqueue-domain-event.ts)                                                 |
| Orchestration  | [`canonical-tour.service.ts`](../../../apps/api/src/canonical/canonical-tour.service.ts) — Prisma: atomic; memory: in-process bus |

| Test                                                                                                          | Proves                                   |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| [`canonical-projection-sync.spec.ts`](../../../apps/api/test/canonical-projection-sync.spec.ts)               | Projection columns on tour row           |
| [`outbox-transactional.integration.spec.ts`](../../../apps/api/test/outbox-transactional.integration.spec.ts) | RULE-008/013 rollback: 0 tour + 0 outbox |

## §5.4-S3 — Relay (VERIFIED)

| Path                                             | Role                                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `apps/api/src/outbox/outbox-relay.ts`            | `FOR UPDATE SKIP LOCKED` claim; `withTenantRls` before `publishDomainEvent` |
| `apps/api/src/outbox/start-outbox-relay.ts`      | `OUTBOX_RELAY_ENABLED`, `OUTBOX_POLL_INTERVAL_MS`                           |
| `apps/api/test/outbox-relay.integration.spec.ts` | Relay-to-bus + SKIP LOCKED + RLS                                            |

## §5.4-S4 — Idempotency (VERIFIED)

| Path                                                        | Role                                     |
| ----------------------------------------------------------- | ---------------------------------------- |
| `infra/sql/003_phase5_processed_domain_events.sql`          | `processed_domain_events` + RLS + grants |
| `apps/api/src/events/idempotent-domain-event-subscriber.ts` | `subscribeIdempotentDomainEvent`         |
| `apps/api/src/events/processed-domain-event-log.ts`         | `tryClaimProcessedDomainEvent`           |
| `apps/api/test/5.4-S4-idempotency.spec.ts`                  | DB unique + double relay                 |

## §5.5 — Audit events (VERIFIED)

> **SoT:** DEC-007 · same TX as tour + outbox

| Path                                         | Role                                                             |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `apps/api/src/audit/audit-logger.ts`         | `appendAuditEvent` — ALS `tenantId` + optional `actorId`         |
| `infra/sql/004_audit_events_append_only.sql` | DB trigger: append-only                                          |
| `apps/api/test/5.5-audit-events.spec.ts`     | Create audit row · cross-tenant RLS · immutability · TX rollback |

## Guards & reports

| Artifact          | Path                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| phase-5 guard     | [`scripts/guards/phase-5-guard.mjs`](../../../scripts/guards/phase-5-guard.mjs)             |
| Scaffold contract | [`apps/api/test/phase-5.contract.spec.ts`](../../../apps/api/test/phase-5.contract.spec.ts) |
| Gate JSON         | `reports/phase-5-gate-YYYY-MM-DD.json`                                                      |

## Scores (honest)

| Metric           | Value                            |
| ---------------- | -------------------------------- |
| Doc navigation   | **100**                          |
| Scaffold         | **43**                           |
| Behavioral       | **29** (2/7: 5.1 scaffold + 5.2) |
| Weighted closure | **~37**                          |
