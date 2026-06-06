# Phase 5 — Closure checklist

```yaml
checklist_meta:
  date: "2026-06-05"
  fail_token: FAIL
  precision_pack: ../appendices/PRECISION-DOC-INDEX.md
  implementation_map: ../appendices/IMPLEMENTATION-MAP.md
  gate_report: ../../../reports/phase-5-gate-2026-06-05.json
```

## A — Prerequisites

| Check                 | Command / file                                                                        | Status                |
| --------------------- | ------------------------------------------------------------------------------------- | --------------------- |
| Node 24               | `nvm use` / `.nvmrc`                                                                  | **PASS**              |
| Phase 4 gate (nested) | `pnpm run phase-4:gate` inside `phase-5:gate`                                         | **PASS** (2026-06-05) |
| Entry yaml            | [`reports/phase-5-entry-verified.yaml`](../../../reports/phase-5-entry-verified.yaml) | blocking fields PASS  |
| DB reset before gate  | `pnpm run db:test-reset` (in `phase-5:gate`)                                          | **PASS**              |

## B — Subphases (behavioral proof required)

| Subphase | Behavioral integration proof                                                                                                                           | Status                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| **5.0**  | phase-4 gate + entry yaml                                                                                                                              | **VERIFIED_SCAFFOLD** |
| **5.1**  | `outbox-rls-forbidden-access.spec.ts` + schema/SQL/Prisma + `phase-5:guard`                                                                            | **VERIFIED**          |
| **5.2**  | `5.2-plugin-validation.spec.ts` · `canonical-validate-before-persist.spec.ts` · `validate-before-persist-ordering.spec.ts`                             | **VERIFIED**          |
| **5.3**  | `canonical-projection-sync.spec.ts` (title/schema_version in atomic TX)                                                                                | **VERIFIED**          |
| **5.4**  | `outbox-transactional.integration.spec.ts` · `5.4-S2-concurrent-tx-stress.spec.ts` · `outbox-relay.integration.spec.ts` · `5.4-S4-idempotency.spec.ts` | **VERIFIED**          |
| **5.5**  | `5.5-audit-events.spec.ts` (append + cross-tenant RLS + immutability + TX rollback)                                                                    | **VERIFIED**          |
| **5.6**  | full `pnpm run phase-5:gate` + this checklist                                                                                                          | **VERIFIED**          |

## C — Gates

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
export DATABASE_URL="postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@127.0.0.1:5434/tour_db"
pnpm run phase-5:gate   # db:test-reset + build + test + phase-4:gate + phase-5:guard
```

| JSON                                                                                    | Rule                       |
| --------------------------------------------------------------------------------------- | -------------------------- |
| [`reports/phase-5-gate-2026-06-05.json`](../../../reports/phase-5-gate-2026-06-05.json) | `ok: true` after full gate |
| Nested phase-4 report                                                                   | `ok: true` required        |

**Gate env (documented):** `P5_PERF_GATE_MS=850` (infra-proven ceiling per [`HARDENED-GATE-REPORT.md`](HARDENED-GATE-REPORT.md)); `PHASE_5_GATE_REPORT=2026-06-05`.

## D — Decision records (DEC)

| ID          | Topic                                                                                                                    | Doc                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| DEC-001–011 | Write orchestrator, TX, projections, outbox, env, idempotency, audit, DLQ, integration test, CI Postgres, subphase order | [`../appendices/IMPLEMENTATION-DECISIONS.md`](../appendices/IMPLEMENTATION-DECISIONS.md) |

## E — Code hygiene (Phase 5 paths)

| Scope                                          | TODO/FIXME |
| ---------------------------------------------- | ---------- |
| `apps/api/src/{canonical,outbox,audit,events}` | **0**      |
| `packages/platform-events`                     | **0**      |

## F — Phase 5 pillars (forensic)

| Pillar           | Proof                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| **Zero-Trust**   | RLS on `outbox_events`, `audit_events`, `processed_domain_events`; relay tenant visibility; cross-tenant specs |
| **Atomicity**    | `withCanonicalTransaction` — tour + audit + outbox single TX; rollback specs                                   |
| **Immutability** | `UNIQUE (tenant_id, domain_event_id)`; `audit_events` append-only trigger; idempotent subscribers              |

## G — Forbidden closure claims

- 5.6 VERIFIED from `p5_contract_spec` scaffold alone
- Skip 5.4/5.5 because guard passes
- Doc 100% = phase closed without behavioral specs
- Mark 5.3 VERIFIED when only Prisma columns exist (sync on write required)

## H — Sign-off order (completed)

```text
5.0 → 5.1 → 5.2 → 5.3 ∥ 5.5 → 5.4 (S1–S4) → 5.6 ✓
```

**Architect sign-off:** Phase 5 data layer **CLOSED** — ready for Phase 6 (Denali workspace integration).

**Open waivers (Phase 6+):** DEC-008 DLQ table deferred; `failed` outbox rows manual ops; perf SLO target 100ms vs measured ~850ms concurrent (documented).
