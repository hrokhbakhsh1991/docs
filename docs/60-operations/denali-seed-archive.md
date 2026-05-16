# Denali seed scripts (archived)

Legacy demo tenant subdomain **`denali`** is **not** used in Six Lock / Phase 7 fixtures. Use **`ws1-rbac`**, **`ws2-rbac`**, **`ws3-rbac`** instead.

## Scripts (opt-in only)

| Script | Package command |
|--------|-----------------|
| Tours | `pnpm --filter @apps/api seed:denali-tours` |
| Presets | `seed:denali-tour-presets` |
| Equipment | `seed:denali-equipment` |
| Locations | `seed:denali-locations` |

All require explicit override:

```bash
ALLOW_DENALI_SEED=1 pnpm --filter @apps/api seed:denali-tours
```

Without `ALLOW_DENALI_SEED=1`, the tour seed exits successfully without mutating data.
