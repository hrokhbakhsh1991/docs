# P4 — Agent Context (Facts Frozen)

```yaml
doc_id: P4-AGENT-CONTEXT
updated: 2026-06-21
current_task: P4-complete
nano_done: 48
status: complete
```

## 1. North star

Close P1 §J: publish→catalog · portal registration · surfaces control. **Done.**

## 2. Truth table (critical review)

| Item                             | Status                                        |
| -------------------------------- | --------------------------------------------- |
| M17 guard + portal OTP           | ✅ built                                      |
| M11 unit specs                   | ✅ built                                      |
| maybeSchedule helper             | ✅ P4-A                                       |
| CanonicalTourService uses helper | ✅ create + update (atomic + scoped)          |
| RV/CP integration specs          | ✅ 9 tests                                    |
| Portal registration (PR/BR)      | ✅ P4-B                                       |
| site_surfaces UI + API           | ✅ P4-C                                       |
| p4:gate script                   | ✅ P4-D — **P4_CLUB_PRODUCT_GATE_OK**         |
| Live publish E2E Playwright      | ⬜ optional — `p4:e2e-gate` (Architect YES)   |
| denali covenant for merge        | ✅ staged export slice · commit pending       |

## 3. NOT gaps (do not rebuild)

- SMK-MKT-01..04 · SMK-PTL-01 · SMK-DREG-01
- public-auth routes · portal registration flow

## 4. Host map

| Surface   | App            | Port dev |
| --------- | -------------- | -------- |
| Marketing | apps/marketing | 3002     |
| Portal    | apps/portal    | 3003     |
| Operator  | apps/web (app) | 3000     |

## 5. Prerequisite

P1 ✅ P2 ✅ P3 ✅
