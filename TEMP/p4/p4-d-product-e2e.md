# P4-D — Product E2E Exit · Nano-Task Spec (AI Lite v2)

```yaml
doc_id: P4-D-PRODUCT-E2E
version: 1.0-aligned
file_map: TEMP/p4/FILE-MAP.md
agent_entry: TEMP/p4/AGENT-START.md
nano_tasks: 10
parent_tasks: 5
start: P4-D-N-001
stop: P4-D-N-010
epic: P4-D
status: complete
execute_after: P4-C-N-012
doc_first: docs/phase-17/platform-club-product-e2e.mdoc
doc_status: complete
quality_target: 9.9+/10
```

> **Doc SoT:** [platform-club-product-e2e.mdoc](../../docs/phase-17/platform-club-product-e2e.mdoc)

## §Facts frozen (2026-06-21)

| #   | Fact                              | Evidence                                            |
| --- | --------------------------------- | --------------------------------------------------- |
| F1  | `p4:gate` script exists           | `scripts/p4-club-product-gate.sh`                   |
| F2  | package.json alias                | `"p4:gate": "bash scripts/p4-club-product-gate.sh"` |
| F3  | M17 in gate chain                 | gate script line 12–13                              |
| F4  | API RV/CP/RR specs green          | 10/10 integration + 4/4 revalidate                  |
| F5  | denali covenant blocks full green | P0 legacy diff                                      |
| F6  | E2E-01 operator publish→catalog   | open — fixture tour `…0210` only                    |
| F7  | Exit checklist exists             | `TEMP/p4-exit-checklist.md`                         |

## Parent task map

| Parent                         | Nano              |
| ------------------------------ | ----------------- |
| P4-D-T-001 Gate script + alias | N-001 N-002 N-003 |
| P4-D-T-002 Closure docs        | N-004 N-005 N-006 |
| P4-D-T-003 Optional heavy E2E  | N-007 N-008       |
| P4-D-T-004 Assessment update   | N-009             |
| P4-D-T-005 Phase exit          | N-010             |

## Phase exit criteria (§J)

| #   | Criterion           | Nano                                |
| --- | ------------------- | ----------------------------------- |
| E1  | Publish → catalog   | N-008 (E2E-01) or RV+CP specs + doc |
| E2  | Portal registration | P4-B-N-014                          |
| E3  | Surfaces UI         | P4-C-N-012                          |
| E4  | `p4:gate` exit 0    | N-003 N-010                         |
| E5  | phase-15-closure P4 | N-005                               |
| E6  | denali diff empty   | covenant                            |

---

## NANO TASKS

### P4-D-N-001 [IMPLEMENT] P4-D-T-001 — p4-club-product-gate.sh

**DO THIS**

1. Compose: import boundary · M17 · denali covenant · API specs · marketing revalidate · portal · web redirect.
2. Use `node --import tsx --test` for TS specs (not plain `node --test`).

**VERIFY** — script matches `platform-club-product-e2e.mdoc` gate block.

**STATUS:** ✅ landed 2026-06-21

**NEXT:** N-002

---

### P4-D-N-002 [IMPLEMENT] P4-D-T-001 — package.json p4:gate alias

**DO THIS**

Add root `"p4:gate": "bash scripts/p4-club-product-gate.sh"`.

**VERIFY** — `pnpm run p4:gate` invokes script.

**STATUS:** ✅ landed

**NEXT:** N-003

---

### P4-D-N-003 [TEST] P4-D-T-001 — EX-01 gate (partial)

**DO THIS**

Run gate through all steps except denali covenant if P0 diff open.

**VERIFY**

| ID     | Assert                                                            |
| ------ | ----------------------------------------------------------------- |
| EX-01  | Steps through marketing revalidate + portal + web exit 0          |
| EX-01b | Full EX-01 requires `git diff --quiet packages/workspaces/denali` |

```bash
pnpm run guard:import-boundary
pnpm run guard:public-catalog-m17
pnpm --filter @apps/api exec node --import tsx --test \
  test/marketing-catalog-revalidate.spec.ts \
  test/club-catalog-publish-integration.spec.ts
pnpm --filter @apps/marketing exec node --import tsx --test test/revalidate-route.spec.ts
```

**NEXT:** N-004

---

### P4-D-N-004 [DOC] P4-D-T-002 — exit checklist complete

**DO THIS**

1. Update `TEMP/p4-exit-checklist.md` with per-EPIC checkboxes and honest status.
2. Mark doc pack items done; impl items in_progress.

**VERIFY** — checklist synced with MANIFEST `nano_done`.

**NEXT:** N-005

---

### P4-D-N-005 [DOC] P4-D-T-002 — phase-15-closure P3+ → P4

**DO THIS**

1. Update `phase-15-closure.mdoc`: catalog/portal/surfaces deferred items point to phase-17 P4.
2. Remove stale "P3+" wording where P4 owns closure.

**VERIFY** — grep `P3+` in closure doc returns P4 references only.

**NEXT:** N-006

---

### P4-D-N-006 [DOC] P4-D-T-002 — ROADMAP-INDEX P4 section

**DO THIS**

Ensure `TEMP/ROADMAP-INDEX.md` lists P4 EPICs with links to phase-17 + TEMP/p4.

**VERIFY** — index row for each EPIC A–D.

**STATUS:** ✅ landed (verify sync)

**NEXT:** N-007

---

### P4-D-N-007 [IMPLEMENT] P4-D-T-003 — p4:e2e-gate stub (optional)

**DO THIS**

1. Add `scripts/p4-club-product-e2e-gate.sh` wrapping Playwright smokes only.
2. Wire `"p4:e2e-gate"` in package.json — **Architect YES** for CI.

**VERIFY** — script documents SMK-MKT-01..04 · SMK-PTL-01 · SMK-DREG-01.

**STOP** — do not run full ci:integrity without Architect YES.

**NEXT:** N-008

---

### P4-D-N-008 [TEST] P4-D-T-003 — E2E-01 operator publish→catalog

**DO THIS**

Playwright flow: operator sets `publishStatus: active` → marketing catalog lists tour.

**VERIFY**

| ID     | Assert                                                      |
| ------ | ----------------------------------------------------------- |
| E2E-01 | New tour visible on marketing list within revalidate window |
| E2E-02 | Marketing CTA → portal register (SMK-MKT-03)                |
| E2E-03 | Super Admin surfaces tab (SF-01)                            |

**STOP** — requires Architect YES for heavy Playwright in gate.

**Alternative v1:** RV-01…RV-05 + CP-01…03 + doc assertion E1 satisfied by unit/integration parity.

**NEXT:** N-009

---

### P4-D-N-009 [DOC] P4-D-T-004 — enterprise assessment product section

**DO THIS**

Update `TEMP/wizard-denali-enterprise-assessment.md` § product surfaces with P4 closure status.

**VERIFY**

| ID    | Assert                                                  |
| ----- | ------------------------------------------------------- |
| EX-03 | Assessment lists G1–G5 gap register with current status |

**NEXT:** N-010

---

### P4-D-N-010 [TEST] P4-D-T-005 — EPIC gate EX-01..03

**DO THIS**

Full phase exit when P4-A/B/C complete.

**VERIFY**

```bash
pnpm run p4:gate   # exit 0 including denali covenant
```

| ID    | Assert                                      |
| ----- | ------------------------------------------- |
| EX-01 | `P4_CLUB_PRODUCT_GATE_OK` printed           |
| EX-02 | M17 in chain                                |
| EX-03 | Assessment + exit checklist marked complete |

**NEXT:** Phase P4 complete → ROADMAP P4 ✅
