# Migration — quick index

**نقشهٔ کل:** [`MIGRATION-MAP.md`](MIGRATION-MAP.md) — شامل §5 infra · §6 events · §7 tenant · §8 versioning · §10 observability

## سندهای فاز (اجرایی — جزئیات کامل)

| فاز | سند |
|-----|------|
| **0** Foundation & SDK | [`phase-0-foundation.md`](phase-0-foundation.md) ✅ |
| **1** Platform core | [`phase-1-platform-core.md`](phase-1-platform-core.md) |

## North star

Platform logic = generic · Workspace logic = injectable · Tenant = security boundary

## فاز جاری

**Phase 1** — ✅ complete (`PlatformWizardEngine` + `phase-1:gate`) · **Next: Phase 2** design-tokens

```bash
pnpm run phase-0:gate   # full phase 0 regression
pnpm build && pnpm test
```

## Legacy

[`legacy/`](../legacy/) — monorepo قبلی؛ مرجع port Denali (فاز ۶).
