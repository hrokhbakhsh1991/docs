# P7-0 — Live infra (staging + seed)

```yaml
epic: P7-0
status: PLANNED
priority: 1
blocks: P7-1
estimate_nanos: TBD
```

## Goal

اولین club مشتری روی **staging** با سه surface + API + Postgres — بدون تغییر محصول.

## Scope

| In | Out |
| -- | --- |
| Deploy checklist اجرا | Prod cutover |
| Seed tenant/owner/tour scaffold | Custom apex (`tenant_domains`) مگر اجباری |
| Env matrix واقعی | Multi-region |
| `smoke-p6-host-bind` روی staging | |

## Work packages (بسط بعدی → nanos)

1. **Staging deploy** — از [phase-19/p6/runbooks/staging-deploy.md](../../phase-19/p6/runbooks/staging-deploy.md)
2. **Customer seed** — از [first-customer-seed.md](../../phase-19/p6/runbooks/first-customer-seed.md)
3. **Host/DNS verify** — `{club}.{root}` · `{club}.portal.{root}` · `{club}.admin.{root}`
4. **Postgres + RLS** — API production path
5. **Smoke** — `node scripts/smoke-p6-host-bind.mjs` روی staging API

## Exit signal

اپراتور می‌تواند با URL staging لاگین کند و tenant درست resolve شود.

## References

- P6 P7-0 carryover: `p6-0` runbooks
