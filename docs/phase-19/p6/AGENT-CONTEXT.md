# P6 Agent context

```yaml
pack_version: "2.0"
priority: guest_slice_first
```

## Architecture (three apps)

```text
┌─────────────────┐   CTA register    ┌─────────────────┐
│ apps/marketing  │ ────────────────► │ apps/portal     │
│ public catalog  │                   │ user OTP intake │
│ shop.{club}     │                   │ {club}.portal   │
└────────┬────────┘                   └────────┬────────┘
         │ same tenantId                      │
         │         ┌──────────────────────────┘
         │         │ pending booking row
         ▼         ▼
┌─────────────────────────────────────────┐
│ apps/web (app)/  — admin operator       │
│ {club}.admin · publish · approve · $    │
└─────────────────────────────────────────┘
```

## Why guest first

Admin panel is mostly built but **flows break** without public + portal. Fix the chain:

```text
publish active → catalog visible → portal register works
```

Full admin (bookings inbox, finance, settings bugs) comes in **P6-2** after that chain is green.

## Customer problem → EPIC

| Pain | EPIC |
| ---- | ---- |
| Wrong tenant / host | P6-0 |
| No tours on public / can't register | P6-1 |
| Admin errors, incomplete ops | P6-2 |
| No member dashboard / receipt | P6-3 |
| Gate + staging | P6-4 |

## Minimal admin during P6-1

Only required for guest slice:

- Create tour in wizard
- Set `publishStatus: active` on review step
- Same club tenant as marketing/portal hosts

Everything else (approve booking, finance) is **P6-2**.

## Key code paths

| Flow | Path |
| ---- | ---- |
| Host → tenant | `GET /public/tenant-context` |
| Catalog | `GET /denali/catalog` · `apps/marketing/app/tours/` |
| Register URL | `apps/marketing/src/portal/resolve-web-registration-url.ts` |
| Register flow | `apps/portal/app/catalog/[tourId]/register/` |
| Publish → cache | `maybeScheduleMarketingCatalogRevalidate` |

## References

- `docs/workspaces/denali/public-catalog.md`
- `docs/phase-9/appendices/BOOKINGS-OPS-UX.md`
- `docs/phase-9/appendices/FINANCE-OPS-UX.md`
