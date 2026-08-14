# Finance Case Operator Encounter Production Wiring (PR12-A)

```yaml
doc_id: FINANCE_CASE_OPERATOR_ENCOUNTER_WIRING
version: "2026-08-07-v2"
package: apps/api Host encounter · apps/web Denali finance UI · @app-tour/finance-case-encounter-ui
status: IMPLEMENTED (PR12-A wiring) + PR12-B HARDENING
phase: PR12-A · PR12-B production hardening
authority: >
  FINANCE_CASE_OPERATOR_READONLY_SURFACE · PR8-B Encounter UI ·
  PR9-B Command Bridge · PR11-C Denali composition ·
  FINANCE_CASE_INTERPRETER_BOUNDARY · PR12-B Hardening
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_READONLY_SURFACE.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md
  - packages/finance-case-encounter-ui/
  - packages/finance-http/
  - apps/api/src/workspace-finance/case/encounter/
```

## Purpose

Expose Denali Finance Case meaning to operators through the existing **read-only** Encounter surface.

```text
Operator understands: reading · owner · posture · confidence · completeness · attention
Operator cannot: mutate finance · approve/reject · workflow transitions · bypass SoT
```

---

## Hard locks (PR12-A)

| Lock | Meaning |
| ---- | ------- |
| UI consumes EncounterView / presentation only | No CaseOutput / FactSnapshot in UI |
| Workspace owns composition | finance-core remains UI-unaware |
| Refresh = new execution | Never patch client Case state |
| Reconciliation = attention only | No automatic escalation workflow |
| Missing facts remain unknown | UI cannot infer absence |
| No finance mutation from this surface | No Command Bridge chrome in PR12-A |

---

## Pipeline

```text
Denali Operator UI (CaseEncounterReadOnlyHost)
        ↓  GET /api/finance/case/encounters/:registrationId
Web BFF proxy
        ↓  GET /finance/case/encounters/:registrationId
Host Encounter Adapter (authz → compose → execute → project → presentation DTO)
        ↓
CaseEncounterViewContract JSON only
```

---

## Host Encounter Adapter

`apps/api/src/workspace-finance/case/encounter/`

| Artifact | Role |
| -------- | ---- |
| `authorizeCaseEncounterView` | Operator access gate (same class as finance ops; no shadow privilege escalation) |
| `toCaseEncounterPresentation` | CaseEncounterView → presentation DTO (strips CaseOutput / FactSnapshot) |
| `loadDenaliCaseEncounterPresentation` | resolve caseKey + authz + compose + execute + project + present |
| `handleFinanceCaseEncounter` | finance-http GET — Host port returns presentation only |
| `loadFinanceCaseEncounterHttp` | Authz → rollout → compose → execute → project → present |

Forbidden response fields: FactSnapshot, CaseOutput, providers, SoT DTOs, gateway refs.

---

## Reconciliation display

| Allowed | Forbidden (unless already in EncounterView) |
| ------- | --------------------------------------------- |
| Attention class / mapped label for `reconciliation_attention` | “Payment is invalid” |
| Safe copy: evidence differs from recorded settlement | “Finance must fix this” / “Gateway failed” as invented verdicts |

---

## Denali UI

- Package: `@app-tour/finance-case-encounter-ui`
- Route: `/finance/case/[registrationId]` (operator session + finance module gate)
- Labels: Denali product terminology + attention class map only

---

## Proofs

See `encounter-production-wiring.spec.ts` + web boundary specs.

---

## PR12-B — Production hardening

See [`FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md`](./FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md).

HTTP ownership via `GET /finance/case/encounters/:registrationId` in finance-http · Host rollout flags · fail-open telemetry · safety proofs.
