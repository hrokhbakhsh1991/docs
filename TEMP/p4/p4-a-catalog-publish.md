# P4-A — Catalog Publish Sync · Nano-Task Spec (AI Lite v2)

```yaml
doc_id: P4-A-CATALOG-PUBLISH
version: 1.0-aligned
file_map: TEMP/p4/FILE-MAP.md
agent_entry: TEMP/p4/AGENT-START.md
nano_tasks: 12
parent_tasks: 6
start: P4-A-N-001
stop: P4-A-N-012
epic: P4-A
status: complete
execute_after: P2 complete
doc_first: docs/phase-17/platform-club-catalog-publish.mdoc
doc_status: complete
quality_target: 9.9+/10
```

> **Doc SoT:** [platform-club-catalog-publish.mdoc](../../docs/phase-17/platform-club-catalog-publish.mdoc)

## §Facts frozen (2026-06-21)

| #   | Fact                                                | Evidence                                         |
| --- | --------------------------------------------------- | ------------------------------------------------ |
| F1  | shouldInvalidate + schedule exist                   | marketing-catalog-revalidate.spec.ts             |
| F2  | Non-atomic path calls revalidate                    | canonical-tour.service.ts:114,253                |
| F3  | Atomic path wired via CanonicalTourService after TX | canonical-tour.service.ts + maybeSchedule helper |
| F4  | Env unset = no-op                                   | schedule-marketing-catalog-revalidate.ts:23      |
| F5  | M17 guard exists                                    | guard-public-catalog-m17.mjs                     |

## Parent task map

| Parent                                 | Nano        |
| -------------------------------------- | ----------- |
| P4-A-T-001 Integration harness         | N-001 N-002 |
| P4-A-T-002 Shared helper + atomic wire | N-003 N-004 |
| P4-A-T-003 RV/CP specs                 | N-005 N-006 |
| P4-A-T-004 Marketing revalidate route  | N-007 N-008 |
| P4-A-T-005 Env + doc cross-ref         | N-009 N-010 |
| P4-A-T-006 EPIC gate                   | N-011 N-012 |

## NANO TASKS

### P4-A-N-001 [IMPLEMENT] P4-A-T-001 — integration spec scaffold

1. Create `apps/api/test/club-catalog-publish-integration.spec.ts`
2. Helpers: `mockRevalidateEnv()` · `captureScheduleCalls()` stub
3. No assertions yet

**NEXT:** N-002

### P4-A-N-002 [TEST] P4-A-T-001 — harness exports

| ID    | Assert                  |
| ----- | ----------------------- |
| RV-00 | spec file loads helpers |

**NEXT:** N-003

### P4-A-N-003 [IMPLEMENT] P4-A-T-002 — maybeScheduleMarketingCatalogRevalidate

1. Create `apps/api/src/marketing/maybe-schedule-marketing-catalog-revalidate.ts`
2. Refactor canonical-tour.service to use helper

**NEXT:** N-004

### P4-A-N-004 [IMPLEMENT] P4-A-T-002 — atomic path wire

Wire helper after atomic tour update/create commit

**NEXT:** N-005

### P4-A-N-005 [TEST] P4-A-T-003 — RV specs

| ID    | Assert                               |
| ----- | ------------------------------------ |
| RV-01 | atomic update draft→active schedules |
| RV-02 | atomic update draft only does not    |
| RV-03 | non-atomic parity unchanged          |
| RV-04 | env unset no fetch                   |
| RV-05 | urban published schedules            |

**NEXT:** N-006

### P4-A-N-006 [TEST] P4-A-T-003 — CP specs

| ID    | Assert                    |
| ----- | ------------------------- |
| CP-01 | active create invalidates |
| CP-02 | draft create does not     |
| CP-03 | active edit invalidates   |

**NEXT:** N-007

### P4-A-N-007 [TEST] P4-A-T-004 — marketing revalidate route

Test `apps/marketing/app/api/revalidate/route.ts` auth

| ID    | Assert                                                  |
| ----- | ------------------------------------------------------- |
| RR-01 | 503 when secret unset                                   |
| RR-02 | 401 wrong secret                                        |
| RR-03 | 400 missing tenantId                                    |
| RR-04 | authorized reaches revalidateTag (Next runtime for 200) |

**STATUS:** ✅ done 2026-06-21

**NEXT:** N-008

### P4-A-N-008 [IMPLEMENT] P4-A-T-004 — revalidate route spec file

`apps/marketing/test/revalidate-route.spec.ts`

**STATUS:** ✅ done 2026-06-21

**NEXT:** N-009

### P4-A-N-009 [DOC] P4-A-T-005 — public-catalog cross-ref

Link public-catalog.md § M11 → phase-17

**STATUS:** ✅ done 2026-06-21

**NEXT:** N-010

### P4-A-N-010 [TEST] P4-A-T-005 — soft metadata path

Skip if P3-A-N-011 not merged — documented in mdoc non-goals

**STATUS:** ✅ done 2026-06-21 (soft skip documented)

**NEXT:** N-011

### P4-A-N-011 [TEST] P4-A-T-006 — EPIC verify

```bash
pnpm run guard:public-catalog-m17
pnpm --filter @apps/api exec node --import tsx --test \
  test/marketing-catalog-revalidate.spec.ts \
  test/club-catalog-publish-integration.spec.ts \
  test/club-catalog-publish-service.spec.ts
```

**STATUS:** ✅ done 2026-06-21

**NEXT:** N-012

### P4-A-N-012 [TEST] P4-A-T-006 — EPIC gate

All P4-A specs exit 0 · denali diff empty (covenant separate)

**STATUS:** ✅ specs green 2026-06-21 (23/23 API + 4 RR)

**NEXT:** P4-B-N-001
