# ASM-9.6 — Settings registry states

```yaml
map_id: AGENT-STATE-MAP-9.6
subphase: "9.6"
state_count: 12
decisions: [DEC-P9-009, DEC-P9-010, DEC-P9-005]
```

| State ID    | Trigger                                     | Guard                    | Next                            |
| ----------- | ------------------------------------------- | ------------------------ | ------------------------------- |
| ASM-9.6-001 | GET /settings/modules                       | session                  | 200 filtered manifest           |
| ASM-9.6-002 | GET /settings/resources/{id} unknown module | registry                 | **404** SETTINGS_MODULE_UNKNOWN |
| ASM-9.6-003 | POST resource member role                   | CASL                     | **403**                         |
| ASM-9.6-004 | POST resource admin                         | isAdminOrOwner + ability | **201**                         |
| ASM-9.6-005 | PUT config invalid Zod                      | schema                   | **400**                         |
| ASM-9.6-006 | PUT config unsupported version              | migrate                  | **409** or migrate up           |
| ASM-9.6-007 | PUT config success                          | cache bust               | **200** + invalidate            |
| ASM-9.6-008 | Wizard read post-PUT                        | effective resolver       | SMK-P9-05 seed                  |
| ASM-9.6-009 | Urban host Denali module route              | manifest filter          | **404** or hidden nav           |
| ASM-9.6-010 | PATCH /urban/settings admin                 | owner-only               | **403** INV-P8-007              |
| ASM-9.6-011 | Cross-tenant resource id                    | RLS                      | **404**                         |
| ASM-9.6-012 | Audit explorer PUT                          | readonly                 | **405**                         |

Spec: `settings-modules.spec.ts` · `settings-resources.spec.ts` · `settings-template.spec.ts` · `settings-generic-crud.spec.ts`
