# ADR: CSR direct API vs Next.js BFF

**Status:** Accepted (interim)  
**Date:** 2026-05-16

## Context

The web app serves workspace UI on `{slug}.{TENANT_ROOT_DOMAIN}`. Tenant context must align across SSR, BFF, and CSR.

Today:

- **Auth** and **settings** (partial) use Next.js route handlers (`/api/auth/*`, `/api/settings/*`) → `bffFetch` → Nest.
- **Tours, users, bookings** use same-origin BFF (`/api/tours`, `/api/users`, `/api/bookings`) via `bffBrowserClient`.
- **Registrations, payments, audit, leader dashboard** still use `apiClient` to tenant-scoped API origin until migrated.

Six Lock **B** only mandates BFF for auth. Product §9 “all API via BFF” is not fully met.

## Decision

1. **Until a dedicated BFF migration epic:** CSR direct calls to the tenant-scoped API origin remain **allowed** for tours/users/bookings, provided:
   - UI is always opened on a valid workspace host (`ws*-rbac.localhost` in dev).
   - Session cookie is HttpOnly; API enforces JWT + Host alignment + RLS.
   - CORS in production uses an explicit allowlist (`CORS_ORIGIN` + optional `CORS_ALLOW_TENANT_SUBORIGINS`).

2. **New features** should prefer Next BFF (`app/api/*` + `proxyBff*`) when they need to hide upstream URLs, centralize host guard errors, or add server-side policy before Nest.

3. **Do not** reintroduce `NEXT_PUBLIC_API_URL` pointing at a single fixed tenant host.

## Consequences

- Hybrid architecture is documented and gated (Six Lock + Phase 7).
- Future work: incremental migration of `apiClient` call sites to BFF routes; no big-bang required for current wizard/settings work on ws1–ws3.

## References

- BFF migration: `apps/web/lib/api/bff-browser-client.ts` and `app/api/*` routes
- `apps/web/lib/tenant/README.md`
