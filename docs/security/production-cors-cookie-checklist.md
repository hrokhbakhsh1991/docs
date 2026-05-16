# Production CORS & session cookie checklist

Use before first multi-tenant production cutover (CORS prod + session cookie domain).

## API (Nest `apps/api`)

| Variable | Production value | Notes |
|----------|------------------|--------|
| `TENANT_ROOT_DOMAIN` | `app.example.com` | Must match web `NEXT_PUBLIC_TENANT_ROOT_DOMAIN`. |
| `CORS_ALLOW_TENANT_SUBORIGINS` | `true` | Allows `https://{slug}.app.example.com` when listed in policy (HTTPS required). |
| `CORS_ORIGIN` | `https://app.example.com` | Apex/marketing origins **not** covered by wildcard suborigin rule. |
| `TRUST_PROXY_HOPS` | `2` (typical) | Must match CDN + ingress depth for `Host` / `X-Forwarded-Host`. |
| `PUBLIC_WEB_ORIGIN` | `https://app.example.com` | Invite links when set. |

**Verify after deploy:**

```bash
# Allowed workspace origin (replace slug + domain)
curl -sI -X OPTIONS "https://SLUG.app.example.com/api/v2/auth/web/phone/preflight" \
  -H "Origin: https://SLUG.app.example.com" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control

# Denied evil origin
curl -sI -X OPTIONS "https://SLUG.app.example.com/api/v2/tours" \
  -H "Origin: https://evil.example" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control
```

Expect `Access-Control-Allow-Origin` only for allowed origins. Automated smoke: `node scripts/verify-phase-7-tenant-security.mjs` (when API is up).

## Web (Next `apps/web`)

| Variable | Production value | Notes |
|----------|------------------|--------|
| `NEXT_PUBLIC_TENANT_ROOT_DOMAIN` | `app.example.com` | Same as API. |
| `NEXT_PUBLIC_API_DYNAMIC_ORIGIN` | `true` | Browser calls API on `{slug}.app.example.com` (or gateway path). |
| `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN` | `.app.example.com` | Leading dot — cookie visible on all tenant subdomains. |
| `NEXT_PUBLIC_SESSION_COOKIE_SAME_SITE` | `none` | Required for cross-subdomain cookie; forces `Secure`. |
| HTTPS | required | `build-session-cookie.ts` sets `secure: true` in production. |

**Verify after deploy:**

1. Login on `https://ws1.app.example.com` → session cookie `Domain=.app.example.com`, `HttpOnly`, `Secure`, `SameSite=None`.
2. Navigate to `https://ws2.app.example.com` → workspace switch or re-auth per product rules; cookie must not leak across tenants without explicit session exchange.
3. `POST /api/auth/logout` on web clears cookie (Playwright: `tests/auth/session-logout.spec.ts`).

## Docker build args (web image)

See `infra/docker/Dockerfile.web` — set at build time:

- `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN=.app.example.com`
- `NEXT_PUBLIC_SESSION_COOKIE_SAME_SITE=none`

## Related

- [`docs/multi-tenant-subdomain.md`](../multi-tenant-subdomain.md) § production env
- [`production-runbook.md`](../../production-runbook.md) § 1.1–1.2
- [`csrf-xss-baseline-checklist.md`](csrf-xss-baseline-checklist.md)
