# P5-B — Denali Operator Parity · Nano-Task Spec (AI v2)

```yaml
doc_id: P5-B-OPERATOR-PARITY
version: 2.1-ai-friendly
nano_tasks: 16
start: P5-B-N-001
stop: P5-B-N-016
epic: P5-B
optional: false
prerequisite: P5-A-N-007
doc_first: docs/phase-18/platform-denali-operator-parity.mdoc
preservation: TEMP/p5/PRESERVATION-CHECKLIST.md
quality_target: 9.6+/10
exit_core: true
```

> **Doc SoT:** `docs/phase-18/platform-denali-operator-parity.mdoc`

## §Facts frozen

| # | Fact | Evidence |
|---|------|----------|
| F1 | Package wizard works today | golden `tour-publish-ready.json` |
| F2 | Metadata adapter merges overlay | `adaptMetadataPayloadToWorkspacePlugin` |
| F3 | Denali rules stay in package | covenant R3 |
| F4 | Receipt flow live | `/finance/receipts` |
| F5 | Gap list authoritative | `legacy-vs-denali-gap-analysis.md` |

## STOP rules (AI)

- Do **not** edit `denali/src/rules/` to "achieve parity"
- Do **not** change Denali to gateway payment
- Do **not** skip PC-01..10 preservation gate

## Parent tasks

| Parent | Nano |
|--------|------|
| T-001 Doc matrix | N-001 N-002 |
| T-002 Lifecycle | N-003 N-004 |
| T-003 Validation | N-005 N-007 N-008 |
| T-004 Metadata path proof | N-006 N-009 N-010 |
| T-005 Audit | N-011 N-012 |
| T-006 Preservation + exit | N-013 N-014 N-015 N-016 |

---

### P5-B-N-001 [DOC] T-001 — parity mdoc

1. Ensure `docs/phase-18/platform-denali-operator-parity.mdoc` matches this spec
2. Gap → owner table complete

| ID | Assert |
|----|--------|
| DOC-B-01 | mdoc execution_spec points here |
| DOC-B-02 | preservation matrix PC-01..10 |

**NEXT:** N-002

---

### P5-B-N-002 [DOC] T-001 — nano ↔ gap map

Add table in mdoc: each B-003..B-013 maps to gap ID + assert band.

**NEXT:** N-003

---

### P5-B-N-003 [IMPLEMENT] T-002 — lifecycle matrix

1. `apps/api/src/canonical/assert-tour-lifecycle-transition.ts`
2. `apps/api/test/tour-lifecycle-transition.spec.ts`

| ID | Assert |
|----|--------|
| LC-01 | DRAFT→OPEN allowed when gates pass |
| LC-02 | OPEN→DRAFT rejected |
| LC-03 | CANCELLED terminal |

**Files:** canonical only · **NEXT:** N-004

---

### P5-B-N-004 [IMPLEMENT] T-002 — publish gates

Wire publish transition in `canonical-tour.service.ts` using lifecycle helper.

| ID | Assert |
|----|--------|
| LC-04 | publish calls transition assert |
| LC-05 | failed gate → 400 |
| LC-06 | success on golden package path |

**NEXT:** N-005

---

### P5-B-N-005 [IMPLEMENT] T-003 — draft vs publish validation

Extend `canonical-validation-sync.ts` — RuleContext `mode: draft|publish`.

| ID | Assert |
|----|--------|
| VAL-01 | draft create relaxed |
| VAL-02 | publish strict on golden |
| VAL-03 | metadata path same as package |

**NEXT:** N-006

---

### P5-B-N-006 [TEST] T-004 — golden metadata path

`workspace-metadata-denali-parity-publish.spec.ts` or extend existing parity specs.

| ID | Assert |
|----|--------|
| RP-01 | flag+binding+denali-v1.json validates |
| RP-02 | render plan field ids match package |
| RP-03 | compositeId match |
| RP-04 | publishStatus transition |

**NEXT:** N-007

---

### P5-B-N-007 [IMPLEMENT] T-003 — form profile strip

`strip-form-profile-for-submit.ts` + spec VAL-02b

**NEXT:** N-008

---

### P5-B-N-008 [IMPLEMENT] T-003 — catalog refs

`assert-catalog-ref-integrity.ts` — themes/leaders ids

| ID | Assert |
|----|--------|
| VAL-03 | invalid theme id fails publish |

**NEXT:** N-013

---

### P5-B-N-009 [IMPLEMENT] T-004 — operator web plugin resolve

`apps/web/src/wizard/resolve-operator-workspace-plugin.ts`

| ID | Assert |
|----|--------|
| WEB-01 | binding+flag → metadata loader |
| WEB-02 | no binding → package plugin |

**NEXT:** N-013

---

### P5-B-N-010 [TEST] T-004 — publish integration metadata path

`denali-metadata-path-publish-integration.spec.ts`

| ID | Assert |
|----|--------|
| E2E-01 | create→publish on metadata path |
| E2E-02 | catalog hook still fires (P4) |
| E2E-03 | offline_receipt unchanged |

**NEXT:** N-013

---

### P5-B-N-011 [IMPLEMENT] T-005 — PATCH audit

Extend audit beyond DEC-007 create-only.

| ID | Assert |
|----|--------|
| AUD-02 | PATCH tour writes audit row |

**NEXT:** N-013

---

### P5-B-N-012 [IMPLEMENT] T-005 — publish audit

| ID | Assert |
|----|--------|
| AUD-03 | publish writes audit row |

**NEXT:** N-013

---

### P5-B-N-013 [TEST] T-006 — client/server rules parity

Package `evaluateFormRules` output ≡ metadata path for golden fixture.

| ID | Assert |
|----|--------|
| RP-05 | same visible fields draft step 0 |

**NEXT:** N-014

---

### P5-B-N-014 [TEST] T-006 — preservation gate

`p5-preservation-gate.spec.ts` — static + hook references for PC-01..10

| ID | Assert |
|----|--------|
| PC-GATE-01 | checklist lists 10 surfaces |
| PC-GATE-02 | denali.plugin exports tourClone+tourList+operatorSettings |

**NEXT:** N-015

---

### P5-B-N-015 [DOC] — FILE-MAP sync B rows ✅

**NEXT:** N-016

---

### P5-B-N-016 [TEST] T-006 — **P5-core exit**

`platform-denali-operator-parity-exit.spec.ts` + update exit checklist path A

| ID | Assert |
|----|--------|
| EX-B-01 | p5:gate green |
| EX-B-02 | preservation spec green |
| EX-B-03 | path A checklist items documented |
