# P6 Agent context

```yaml
pack_version: "2.1"
priority: guest_slice_first
addressing: dual_model
```

## Architecture (three apps · one tenant)

```text
┌─────────────────────────┐     CTA      ┌─────────────────────────┐
│ apps/marketing          │ ───────────► │ apps/portal             │
│ PUBLIC surface          │              │ USER surface            │
│ {club}.{root}           │              │ {club}.portal.{root}    │
│ or denali.club (custom) │              │ or portal.denali.club   │
└───────────┬─────────────┘              └───────────┬─────────────┘
            │ same tenantId                          │
            │              pending booking             │
            ▼              ▼                           │
┌─────────────────────────────────────────────────────┴───────────┐
│ apps/web (app)/  — ADMIN surface                                 │
│ {club}.admin.{root}  or  admin.denali.club                       │
└──────────────────────────────────────────────────────────────────┘
```

**Tenants are isolated** — `denali.club` and `alborz.ir` never share host resolution.

**Workspaces** (`denali`, `urban`) = product plugin after tenant lookup — not domain labels.

→ [p6-host-addressing-architecture.mdoc](../p6-host-addressing-architecture.mdoc)

## Why guest first

Admin panel is mostly built but **flows break** without public + portal. Fix the chain:

```text
publish active → catalog visible → portal register works
```

Full admin (bookings inbox, finance, settings bugs) comes in **P6-2** after that chain is green.

## Customer problem → EPIC

| Pain | EPIC |
| ---- | ---- |
| Wrong tenant / host / custom domain | P6-0 |
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
| Host → tenant | `resolvePublicIngressSubdomain` · `GET /public/tenant-context` |
| Platform URLs | `buildClubSiteUrls` |
| Custom domain | `resolveTenantFromCustomDomainHost` · `tenant_domains` |
| Catalog | `GET /denali/catalog` · `apps/marketing/app/tours/` |
| Register URL | `resolveWebRegistrationUrl` → `buildDevPortalPublicBaseUrl` (`@app-tour/tenant-kernel`) |
| Member `/me` | `apps/portal/app/me/` · BFF `app/api/me/` → `bookings?view=mine` |
| Register flow | `apps/portal/app/catalog/[tourId]/register/` |
| Publish → cache | `maybeScheduleMarketingCatalogRevalidate` |

## References

- [p6-host-addressing-architecture.mdoc](../p6-host-addressing-architecture.mdoc)
- [runbooks/host-subdomain-map.md](runbooks/host-subdomain-map.md)
- `docs/workspaces/denali/public-catalog.md`
- `docs/phase-9/appendices/BOOKINGS-OPS-UX.md`
- `docs/phase-9/appendices/FINANCE-OPS-UX.md`
