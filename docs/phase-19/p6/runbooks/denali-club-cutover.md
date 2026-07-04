# Denali.club custom apex cutover (WRS Phase 5)

```yaml
nano: WRS-P5-N-001
authority: ../../../standards/workspace-routing-standard.mdoc
tenant_label: denali
example_apex: denali.club
```

## Target hosts (WRS canonical)

| Surface | FQDN | App | Env override |
| ------- | ---- | --- | -------------- |
| Public | `denali.club` | marketing :3002 | `MARKETING_PUBLIC_BASE_URL=https://denali.club` |
| User | `portal.denali.club` | portal :3003 | `PORTAL_PUBLIC_BASE_URL=https://portal.denali.club` |
| Admin | `admin.denali.club` | web :3000 | platform `{club}.admin.{root}` until H-P6-03 web ingress; **dev seed + smoke map** ready |

Paths on public host:

```text
denali.club/           → landing
denali.club/tours      → public catalog
denali.club/tours/{id} → tour detail
```

## Prerequisites

- [ ] Tenant row exists (`tenants.subdomain` = club label bound to Denali plugin)
- [ ] DNS A/AAAA or CNAME for apex + `portal.` + `admin.` subdomains
- [ ] TLS certificates (Caddy / ACME per zone)
- [ ] Reverse proxy routes apex → marketing, `portal.` → portal, `admin.` → web

## Step 1 — `tenant_domains` rows

### Dev (Postgres + denali tenant seeded)

```bash
pnpm --filter @apps/api run db:seed
pnpm --filter @apps/api run seed:wrs-denali-club-domains
```

This upserts `denali.club`, `portal.denali.club`, and `admin.denali.club` for tenant `00000000-0000-4000-8000-000000000003`.

### Production

Insert verified rows (production — use Platform Control Center when available):

| hostname | surface | status |
| -------- | ------- | ------ |
| `denali.club` | `marketing` | verified + SSL active |
| `www.denali.club` | `marketing` | optional alias |
| `portal.denali.club` | `portal` | verified + SSL active |

Admin custom surface (`admin.denali.club`) deferred — H-P6-03. Use `https://denali.admin.{platform-root}` until then.

Dev stub (Postgres local only):

```sql
-- Replace :tenant_id with Denali club UUID from tenants table
INSERT INTO tenant_domains (id, tenant_id, hostname, surface, status, ssl_status, created_at, updated_at)
VALUES
  (gen_random_uuid(), ':tenant_id', 'denali.club', 'marketing', 'verified', 'active', now(), now()),
  (gen_random_uuid(), ':tenant_id', 'portal.denali.club', 'portal', 'verified', 'active', now(), now())
ON CONFLICT DO NOTHING;
```

## Step 2 — App env (production deploy profile)

Set both overrides in production (recommended). Kernel custom-apex heuristics (`portal.{apex}`) cover partial misconfig, but explicit env is the canonical prod contract (WRS-URL-02).

**apps/marketing**

```bash
MARKETING_PUBLIC_BASE_URL=https://denali.club
PLATFORM_ROOT_DOMAIN=your-platform-root.example.com
TOUR_OPS_API_URL=http://127.0.0.1:3001
```

**apps/portal**

```bash
PORTAL_PUBLIC_BASE_URL=https://portal.denali.club
MARKETING_PUBLIC_BASE_URL=https://denali.club
TOUR_OPS_API_URL=http://127.0.0.1:3001
```

**apps/web**

```bash
MARKETING_PUBLIC_BASE_URL=https://denali.club
PORTAL_PUBLIC_BASE_URL=https://portal.denali.club
TOUR_OPS_API_URL=http://127.0.0.1:3001
```

Until H-P6-03 web custom admin ingress ships, operators use `https://denali.admin.{platform-root}` in production. Dev maps `admin.denali.club` via `resolveTenantIdFromDevHost(..., "admin")`.

## Step 2.5 — Reverse proxy (Caddy custom apex)

Per-tenant zone (not platform `{club}.{root}`). Forward **`Host`** and **`X-Forwarded-Host`** unchanged — API BFF resolves tenant from ingress.

```caddyfile
# /etc/caddy/sites/denali.club.caddy — ports from caddy.env
denali.club, www.denali.club {
	reverse_proxy 127.0.0.1:{$MARKETING_PORT:3002} {
		header_up Host {host}
		header_up X-Forwarded-Proto {scheme}
		header_up X-Forwarded-Host {host}
	}
}

portal.denali.club {
	reverse_proxy 127.0.0.1:{$PORTAL_PORT:3003} {
		header_up Host {host}
		header_up X-Forwarded-Proto {scheme}
		header_up X-Forwarded-Host {host}
	}
}

admin.denali.club {
	reverse_proxy 127.0.0.1:{$WEB_PORT:3000} {
		header_up Host {host}
		header_up X-Forwarded-Proto {scheme}
		header_up X-Forwarded-Host {host}
	}
}
```

Platform mother ingress (multi-tenant `{club}.{root}`) remains in [`deploy/vps/caddy/Caddyfile`](../../../../deploy/vps/caddy/Caddyfile).

## Step 3 — Smoke (host header)

With API running and `tenant_domains` seeded (or `WRS_SMOKE_CUSTOM_APEX=1` for memory smoke):

```bash
TOUR_OPS_API_URL=http://127.0.0.1:3001 \
P6_WRS_EXPECT_TENANT_ID=00000000-0000-4000-8000-000000000003 \
pnpm run smoke:pcms-custom-apex
```

Legacy API-only check (same three hosts, Prisma seed or `WRS_SMOKE_CUSTOM_APEX=1`):

```bash
pnpm run smoke:wrs-custom-apex
```

Playwright custom apex (cookie Domain + resume):

```bash
pnpm --filter @apps/portal run test:smoke:custom-apex
```

## Step 4 — E2E checklist

- [ ] `https://denali.club/` — landing renders club branding (GuestHomeFull: hero, latest, trust, final CTA)
- [ ] SDK-HOME-01..03 + SMK-P6-MKT-HOME green on main before prod deploy
- [ ] `https://denali.club/tours` — catalog list (same tenant as admin publish)
- [ ] Tour detail CTA → `https://portal.denali.club/catalog/{id}/register`
- [ ] Marketing header «ثبت‌نام‌های من» → `https://portal.denali.club/me/registrations` (static link; portal handles auth)
- [ ] Logged-in member opens second tour register → intake without OTP (PCMS SMK-PTL-07)
- [ ] Portal home (guest) → redirects to `https://denali.club`
- [ ] Web `/catalog` on club admin host → 308 to `https://denali.club/tours`

## Step 5 — Member session (PCMS)

On custom apex, portal sets `Domain=denali.club` on `atour_mb_session` after `register-complete` (new guest) or `verify-otp` (returning member). SSR resume uses allowlisted `fetchMemberProfileFromSession` (same upstream as profile BFF). Client flow may hydrate intake when `Domain=<apex>` cookies are not visible to RSC. See [member-session-portal-authority.mdoc](../../../standards/member-session-portal-authority.mdoc).

Memory smoke (`OPERATOR_SMOKE_E2E_SEED=1`): tour `…0210` is seeded on both tenant `…000014` (platform portal) and `…000003` (custom apex) — required for SMK-PTL-07 and SMK-PTL-08.

## Rollback

1. Remove or disable `tenant_domains` rows
2. Unset `MARKETING_PUBLIC_BASE_URL` / `PORTAL_PUBLIC_BASE_URL`
3. Revert DNS to platform default `{club}.{platform-root}`

## References

- [workspace-routing-standard.mdoc](../../../standards/workspace-routing-standard.mdoc)
- [member-session-portal-authority.mdoc](../../../standards/member-session-portal-authority.mdoc)
- [marketing-landing.mdoc](../../../workspaces/denali/marketing-landing.mdoc) — landing spec v7
- [host-subdomain-map.md](host-subdomain-map.md)
- [p6-host-addressing-architecture.mdoc](../../p6-host-addressing-architecture.mdoc) §3.2
