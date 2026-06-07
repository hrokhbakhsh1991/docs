# DEPRECATED — phase8-wip-specs

```yaml
deprecated: "2026-06-07"
reason: Block C6 — canonical scaffolds live under apps/api/test/
```

Duplicate API spec scaffolds were removed from this folder. Use the canonical paths enforced by `p8_hardening_artifacts`:

| Former TEMP copy                  | Canonical path                                  |
| --------------------------------- | ----------------------------------------------- |
| `urban-owner-ability.spec.ts`     | `apps/api/test/urban-owner-ability.spec.ts`     |
| `urban-settings-patch.spec.ts`    | `apps/api/test/urban-settings-patch.spec.ts`    |
| `urban-redis-fallback.spec.ts`    | `apps/api/test/urban-redis-fallback.spec.ts`    |
| `urban-tours-bypass-gate.spec.ts` | `apps/api/test/urban-tours-bypass-gate.spec.ts` |

Do not recreate WIP copies here — `pnpm run phase-8:guard` validates disk under `apps/api/test/` only.
