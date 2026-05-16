# Web tenant resolution

Single source of truth: `runtime-tenant-context.ts`.

## Layers

| Layer | Slug / tenant source |
|-------|----------------------|
| **Middleware** | `Host` → `resolveTenantSlugFromHost` → optional lookup → `x-tenant-slug` on internal request |
| **SSR (RSC)** | Trusted `x-tenant-slug` from middleware, then `Host` |
| **BFF (`/app/api/*`)** | `resolveBffTenantContext(req)` — **Host only** (never client `x-tenant-slug`) |
| **CSR** | `resolveClientRuntimeTenantContext()` from `window.location.host` |

Host parsing rules live in `@repo/tenant-host` (`workspace-host-policy.ts` wraps the package).

## Related modules

- `lookup-workspace-tenant.ts` — existence probe + shared TTL cache
- `assert-workspace-request.ts` — SSR hard reject / redirect
- `middleware.ts` — apex / invalid / unknown → `/workspace-not-found`

## Auth BFF

| Route | Upstream |
|-------|----------|
| `phone-preflight`, `request-otp`, `login-web-session`, `complete-registration` | `bffFetch` → Nest |
| `accept-invite` | `bffFetchAuth` → Nest |
| `GET/POST/DELETE /api/auth/session` | **Local only** — decode/set/clear HttpOnly JWT cookie |
| `POST /api/auth/logout` | **Local only** — clears session cookie |
| Tours / users / bookings (CSR) | `bffBrowserClient` → `/api/tours`, `/api/users`, `/api/bookings` |

Session and logout intentionally skip Nest: the browser never needs a live API call to read or drop the cookie. Playwright: `tests/auth/session-logout.spec.ts`.

## Removed (do not reintroduce)

- `resolve-tenant-domain.ts`, `resolve-tenant-context-helpers.ts`
- `resolve-tenant-context.ts`, `resolve-tenant-api-origin.ts` (deprecated re-exports)
- `NEXT_PUBLIC_API_URL` for runtime API origin — use dynamic host + `getApiBaseUrl()`

See `docs/multi-tenant-subdomain.md` §9 (Phase 7).
