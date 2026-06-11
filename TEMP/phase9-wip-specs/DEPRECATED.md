# DEPRECATED — Phase 9 promote train complete

```yaml
promoted: "2026-06-08"
trains: T-9.1..T-9.8
guard: phase-9:guard 32/32 PASS
```

All operator prove_with specs live on trunk. Use [`SPEC-REGISTRY-OPERATOR.yaml`](../../docs/phase-9/appendices/SPEC-REGISTRY-OPERATOR.yaml) `on_trunk` — not this folder.

## Remaining WIP files

| File | Reason kept |
| ---- | ----------- |
| `web/urban-owner-access.spec.ts` | Phase 8 regression reference only |

## Canonical paths (quick index)

| Subphase | Example trunk paths |
| -------- | ------------------- |
| 9.1 | `apps/api/test/identity-otp.spec.ts` · `operator-ability.spec.ts` |
| 9.2 | `apps/web/test/dashboard-smoke.spec.ts` |
| 9.3 | `apps/api/test/tours-operator.spec.ts` · `tour-list-projection.spec.ts` |
| 9.4 | `apps/api/test/identity-users.spec.ts` |
| 9.5 | `apps/api/test/bookings-ops.spec.ts` · SDK/denali manifest specs |
| 9.6 | `apps/api/test/settings-*.spec.ts` · settings manifest specs |
| 9.7 | `apps/api/test/finance-ops.spec.ts` · `apps/web/test/finance-page.spec.ts` |
| 9.8 | `apps/web/test/operator-smoke.spec.ts` · `phase-9.contract.spec.ts` |
