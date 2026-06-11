# DEPRECATED — phase8-wip-specs

```yaml
deprecated: "2026-06-08"
reason: T-8.1 promoted ON_TRUNK — WIP spec copies removed
```

All Phase 8.1 scaffolds live on trunk. Do not recreate copies in this folder.

| Concern | Canonical path |
| ------- | -------------- |
| Urban owner ability (SDK-8.1) | `packages/workspaces/urban/test/urban-owner-ability.spec.ts` |
| API owner middleware | `apps/api/test/urban-owner-ability.spec.ts` |
| Settings PATCH matrix | `apps/api/test/urban-settings-patch.spec.ts` |
| Redis fallback | `apps/api/test/urban-redis-fallback.spec.ts` |
| Tour publish-field gate | `apps/api/test/urban-tours-bypass-gate.spec.ts` |
| Web settings guard | `apps/web/test/urban-owner-access.spec.ts` |

Verify: `pnpm run phase-8:guard` → `p8_spec_path_registry`.
