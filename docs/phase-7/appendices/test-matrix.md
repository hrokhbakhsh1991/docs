# Phase 7 — Test matrix

```yaml
matrix_version: "2026-06-04-v2"
honesty: TARGET_until_implementation
inventory: test-inventory.md
```

| Test                                                                   | Subphase | Status | REQ        |
| ---------------------------------------------------------------------- | -------- | ------ | ---------- |
| `packages/workspaces/urban/test/phase-7.contract.spec.ts`              | 7.2, 7.9 | TARGET | REQ-P7-006 |
| `packages/workspaces/urban/test/urban-registry.spec.ts`                | 7.1      | TARGET | REQ-P7-031 |
| `apps/api/test/urban-workspace-plugin.spec.ts`                         | 7.3      | TARGET | REQ-P7-009 |
| `apps/api/test/urban-create-publish.integration.spec.ts`               | 7.4      | TARGET | REQ-P7-012 |
| `apps/api/test/rate-limit-tenant.spec.ts`                              | 7.6      | TARGET | REQ-P7-018 |
| `packages/tenant-kernel/test/tenant-connection-router.spec.ts`         | 7.7      | TARGET | REQ-P7-022 |
| `packages/workspace-sdk/test/urban-workspace-binding.contract.spec.ts` | 7.3      | TARGET | REQ-P7-009 |
| `scripts/guards/audit-log-fields.mjs --phase 7`                        | 7.5      | TARGET | REQ-P7-015 |

**TARGET** = documented verification path; not yet behavioral in trunk. See [`test-inventory.md`](test-inventory.md).
