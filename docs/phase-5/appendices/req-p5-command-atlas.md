# Phase 5 — REQ-P5 command atlas

```yaml
node: ">=24.0.0 <25"
prerequisite: pnpm run phase-4:gate
```

## Full gate

```bash
nvm use && corepack enable && pnpm install
pnpm run phase-5:gate
# = db:test-reset + build + test (P5 perf env) + phase-4:gate + phase-5:guard
# UNCHANGED — still nests phase-4:gate → phase-3:gate
```

## Static guard (scaffold — not runtime / not 5.6 alone)

```bash
pnpm run phase-5:guard
# reports/phase-5-gate-YYYY-MM-DD.json
# docs/schema/prisma/SQL + contract + anti-hollow — NOT RLS/perf
```

## Runtime proof (additive — not a denest of phase-5:gate)

```bash
pnpm run phase-5:runtime-proof
# DATABASE_URL required → db:test-reset → phase-4:guard → targeted P5 perf specs
# reports/phase-5-runtime-proof-YYYY-MM-DD.json
# See docs/phase-5/phase-5-runtime-proof.mdoc
```

## Per subphase

| Subphase | Commands                                                                                                                                                | Pass signal                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **5.0**  | `pnpm run phase-4:gate` · update `reports/phase-5-entry-verified.yaml`                                                                                  | yaml all PASS              |
| **5.1**  | verify `docs/phase-5-canonical-schema.md` · `002_phase5_data_layer.sql` · `pnpm run phase-5:guard`                                                      | p5\_\* scaffold ok         |
| **5.2**  | `pnpm --filter @apps/api test` (or targeted specs below)                                                                                                | assert on reject · no row  |
| **5.2**  | `NODE_ENV=test node --import tsx --test apps/api/test/canonical-validate-before-persist.spec.ts apps/api/test/validate-before-persist-ordering.spec.ts` | **VERIFIED**               |
| **5.3**  | projection sync integration test                                                                                                                        | columns match JSON         |
| **5.4**  | outbox + relay test · `FOR UPDATE SKIP LOCKED` worker                                                                                                   | TourCreated handler        |
| **5.5**  | audit write integration                                                                                                                                 | tenant RLS on audit_events |
| **5.6**  | `pnpm run phase-5:gate` · `pnpm run guard:doc-sync`                                                                                                     | json ok:true both gates    |

## p5\_\* map

| id                              | Verify                                           |
| ------------------------------- | ------------------------------------------------ |
| `p5_canonical_schema_doc`       | DEL-P5-001 md exists                             |
| `p5_sql_migration`              | 002 SQL exists                                   |
| `p5_prisma_models`              | Prisma Outbox/Audit/canonical_data               |
| `p5_with_canonical_transaction` | TS file exists                                   |
| `p5_contract_spec`              | test:phase-5 (**scaffold** — see test-inventory) |
| `p5_anti_hollow`                | anti-hollow-phase5.mjs                           |
