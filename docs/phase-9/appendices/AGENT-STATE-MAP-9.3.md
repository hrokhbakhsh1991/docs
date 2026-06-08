# ASM-9.3 — Tours operator states

```yaml
map_id: AGENT-STATE-MAP-9.3
subphase: "9.3"
authority: subphases/9.3-tours-operator.md · TOURS-LIST-UX.md · DEC-P9-014
state_count: 18
```

## States

| State ID    | Trigger                         | Guard                    | Next                      | Log signature    |
| ----------- | ------------------------------- | ------------------------ | ------------------------- | ---------------- |
| ASM-9.3-001 | GET `/tours?view=operator`      | `requireOperatorSession` | 200 paginated projections | REQ-P9-030       |
| ASM-9.3-002 | GET `/tours` anon operator view | deny                     | 401                       | INV-P9-007       |
| ASM-9.3-003 | PATCH tour member role          | tour ACL                 | 403                       | CP-9.3-02        |
| ASM-9.3-004 | PATCH tour admin                | tour ACL                 | 200                       | CP-9.3-03        |
| ASM-9.3-005 | GET `(app)/tours` web           | session                  | list UI                   | REQ-P9-031       |
| ASM-9.3-006 | Nav wizard link                 | href check               | `/tours/new` only         | DEC-P9-007       |
| ASM-9.3-007 | Route `(app)/tours/new`         | forbidden                | **FAIL** P9-F-004         | duplicate wizard |
| ASM-9.3-008 | GET workspace sub-resources     | tour id + session        | 200 workspace             | CP-9.3 workspace |
| ASM-9.3-009 | List cross-tenant leak          | RLS                      | empty / 403               | TQ-P9-004        |
| ASM-9.3-010 | Publish field PATCH             | publish gate             | 200/403 per role          | denali composite |
| ASM-9.3-011 | Canonical SoT dual-write        | spec regression          | **FAIL**                  | INV-P9-005       |
| ASM-9.3-012 | Denali projection extract       | plugin hook              | render fields             | REQ-P9-032       |
| ASM-9.3-013 | Filter/search list              | query params             | filtered rows             | API-9.3-L02      |
| ASM-9.3-014 | Create via wizard POST          | Phase 6 route            | tour in list              | SMK-P9-02        |
| ASM-9.3-015 | URL search param change         | debounce 300ms           | refetch list              | WEB-9.3-03       |
| ASM-9.3-016 | Status filter select            | UI→API bucket map        | filtered rows             | CP-9.3-L03       |
| ASM-9.3-017 | Duplicate card action           | admin/owner              | `/tours/new?clone=`       | CP-9.3-L09       |
| ASM-9.3-018 | GET `/tours?view=slim`          | Phase 5 path             | cursor response           | CP-9.3-L13       |

## Spec bindings

| State ID                          | Test case                                                      |
| --------------------------------- | -------------------------------------------------------------- |
| ASM-9.3-001..004                  | `apps/api/test/tours-operator.spec.ts`                         |
| ASM-9.3-005..007 · 013 · 015..017 | `apps/web/test/tours-list.spec.ts`                             |
| ASM-9.3-012                       | `packages/workspaces/denali/test/tour-list-projection.spec.ts` |
| ASM-9.3-014                       | `operator-smoke.spec.ts` SMK-P9-02                             |
| ASM-9.3-018                       | `apps/api/test/1-functional/tours-list.spec.ts`                |
