# ASM-9.5 — Registration Command Center states

```yaml
map_id: AGENT-STATE-MAP-9.5
subphase: "9.5"
state_count: 12
authority: BOOKINGS-OPS-UX.md · DEC-P9-011
```

| State ID    | Trigger                  | Guard             | Next                        |
| ----------- | ------------------------ | ----------------- | --------------------------- |
| ASM-9.5-001 | GET /bookings?view=ops   | admin/owner       | 200 paginated queue         |
| ASM-9.5-002 | GET /bookings?view=mine  | member            | 200 own rows only           |
| ASM-9.5-003 | GET /bookings/summary    | admin             | 200 KPI counts              |
| ASM-9.5-004 | POST approve             | admin + txn       | 200 + outbox                |
| ASM-9.5-005 | Approve without outbox   | spec              | **FAIL** P9-F-006           |
| ASM-9.5-006 | Member approve           | deny              | **403**                     |
| ASM-9.5-007 | POST reject              | admin             | 200 + audit reason optional |
| ASM-9.5-008 | POST bulk-approve        | admin + batch cap | 200 partial or full         |
| ASM-9.5-009 | UI inspection approve    | session           | panel closes · row updated  |
| ASM-9.5-010 | GET /leader/review       | leader or admin   | 200 shared shell            |
| ASM-9.5-011 | SMK-P9-04 · SMK-P9-07    | E2E               | approved / created          |
| ASM-9.5-012 | Manifest invalid at load | SDK validate      | boot fail or empty views    |

Spec: `bookings-ops.spec.ts` · `bookings-command-center.spec.ts` · `bookings-ops-manifest.spec.ts`
