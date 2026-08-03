# P5-C — Workspace Commerce Config · Nano-Task Spec (AI v2.9)

```yaml
doc_id: P5-C-COMMERCE
version: 2.9-ai-friendly
nano_tasks: 10
start: P5-C-N-001
stop: P5-C-N-010
epic: P5-C
optional: true
defer_until: second customer
doc_first: docs/phase-18/platform-workspace-commerce.mdoc
denali_frozen: offline_receipt only
quality_target: 9.9+/10
```

> **Doc SoT:** `docs/phase-18/platform-workspace-commerce.mdoc`

## §Facts frozen

| # | Fact |
|---|------|
| F1 | Denali uses offline_receipt today | golden + denaliCore.schema |
| F2 | Receipt routes live | `/finance/receipts` |
| F3 | Platform subscription billing ≠ club PSP | P2-C separate |
| F4 | Gateway blocked until P5-D | GU-02 |

## Denali scope (S0 stop)

- **No** Super Admin payment toggle for Denali
- **No** gatewayProvider on Denali tenants
- PC-07 spec must stay green

## Parent tasks

| Parent | Nano |
|--------|------|
| T-001 Doc + schema | N-001 N-002 |
| T-002 API persist | N-003 N-004 N-005 |
| T-003 UI + guards | N-006 N-007 N-008 N-009 |
| T-004 Exit | N-010 |

---

### P5-C-N-001 [DOC] T-001

Sync mdoc commerce schema + Denali frozen table.

| ID | Assert |
|----|--------|
| DOC-C-01 | mdoc lists Denali exclusion |
| DOC-C-02 | execution_spec points here |

**NEXT:** N-002

---

### P5-C-N-002 [IMPLEMENT] T-001 — Zod commerce schema

`packages/workspace-sdk/src/metadata/commerce-schema.ts`

| ID | Assert |
|----|--------|
| SCH-01 | paymentMode enum offline_receipt | gateway |
| SCH-02 | gatewayProvider zibal | stripe | null |
| SCH-03 | default offline_receipt |

**NEXT:** N-003

---

### P5-C-N-003 [IMPLEMENT] T-002 — persist on definition publish

Merge commerce into definition payload on publish; checksum includes commerce block.

**NEXT:** N-004

---

### P5-C-N-004 [IMPLEMENT] T-002 — tenant binding inherits

When binding set, tour create reads workspace default (non-Denali only).

**NEXT:** N-005

---

### P5-C-N-005 [IMPLEMENT] T-002 — tour create default

`tours.service.ts` — set `pricing.paymentMode` from workspace commerce default.

| ID | Assert |
|----|--------|
| API-03 | starter tenant gets default |
| API-04 | denali tenant stays offline_receipt |

**NEXT:** N-006

---

### P5-C-N-006 [IMPLEMENT] T-003 — Super Admin badge

Show commerce badge only when workspaceType !== denali.

| ID | Assert |
|----|--------|
| UI-02 | denali club hides gateway UI |

**NEXT:** N-007

---

### P5-C-N-007 [TEST] T-003 — single active mode

| ID | Assert |
|----|--------|
| GU-01 | cannot set gateway without provider |

**NEXT:** N-008

---

### P5-C-N-008 [TEST] T-003 — Denali unchanged

| ID | Assert |
|----|--------|
| PC-07 | receipt routes + schema |

**NEXT:** N-009

---

### P5-C-N-009 [TEST] T-003 — gateway blocked

| ID | Assert |
|----|--------|
| GU-02 | gateway mode 503 until P5-D |

**NEXT:** N-010

---

### P5-C-N-010 [TEST] T-004 — EX-C optional exit

`platform-workspace-commerce-exit.spec.ts`
