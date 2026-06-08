# ASM-9.7 — Finance command center states

```yaml
map_id: AGENT-STATE-MAP-9.7
subphase: "9.7"
state_count: 20
decisions: [DEC-P9-016, DEC-P9-002]
authority: FINANCE-OPS-UX.md
```

| State ID    | Trigger                        | Guard                  | Next           |
| ----------- | ------------------------------ | ---------------------- | -------------- |
| ASM-9.7-001 | GET /finance hub denali        | finance module + admin | 200            |
| ASM-9.7-002 | GET /finance urban tenant      | INV-P9-006             | 404            |
| ASM-9.7-003 | GET reports/summary            | isAdminOrOwner         | 200 KPI        |
| ASM-9.7-004 | POST manual payment            | isAdminOrOwner         | 201            |
| ASM-9.7-005 | POST manual when Paid exists   | debt policy            | **409**        |
| ASM-9.7-006 | POST receipt upload member own | registration scope     | 201            |
| ASM-9.7-007 | PATCH receipt approve          | FinanceReceiptReview   | 200 + ledger   |
| ASM-9.7-008 | Reconciliation triage read     | Reconciliation read    | 200            |
| ASM-9.7-009 | Apply ledger adjustment        | Reconciliation manage  | outbox         |
| ASM-9.7-010 | POST prepayment                | R2 · admin             | wallet credit  |
| ASM-9.7-011 | GET invoice registration       | derived read model     | paid/due       |
| ASM-9.7-012 | POST schedule generate         | R2 · sum = invoice     | 201            |
| ASM-9.7-013 | Installment overdue            | R3 · past grace        | status overdue |
| ASM-9.7-014 | Waive installment              | admin audit            | waived         |
| ASM-9.7-015 | Ledger events list             | outbox parse           | read-only      |
| ASM-9.7-016 | Member finance hub             | deny                   | locked/hidden  |
| ASM-9.7-017 | Nest modules/finance added     | P9-F-008               | **FAIL**       |
| ASM-9.7-018 | Dashboard finance widget       | leader+module          | KPI card       |
| ASM-9.7-019 | Float amount in API            | minor string           | **400**        |
| ASM-9.7-020 | Schedule sum mismatch          | generator              | **422**        |

Spec: `finance-ops.spec.ts` · `finance-page.spec.ts` · `reconciliation-triage.spec.ts`
