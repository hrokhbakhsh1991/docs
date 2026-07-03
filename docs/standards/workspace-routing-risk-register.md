# WRS Risk Register — mitigations applied

**Updated:** 2026-07-03

| ID | Risk | Severity | Mitigation | Status |
| -- | ---- | -------- | ---------- | ------ |
| R-01 | Cross-app redirects prepend `shop.` | P0 | `buildDevMarketingPublicBaseUrl` + guest-surface-host shared resolver | ✅ Fixed |
| R-02 | SEO canonical split-brain (shop in OG URLs) | P1 | `resolveMarketingPublicOrigin` uses kernel builder | ✅ Fixed |
| R-03 | Duplicated URL logic web/portal | P1 | `@app-tour/guest-surface-host/resolve-marketing-public-base-url` | ✅ Fixed |
| R-04 | Duplicated PHASE_43 host maps (web vs guest) | P2 | web `resolve-host-tenant` delegates to guest-surface-host `admin` surface | ✅ Fixed |
| R-05 | Playwright/smoke default `shop.operator` | P1 | Canonical `operator.localhost:3002` | ✅ Fixed |
| R-06 | Regressions re-introducing shop egress | P2 | `scripts/guards/guard-wrs-routing.mjs` in phase-6:fast-track | ✅ Fixed |
| R-07 | `resolveTenantIdFromDevHost` hardcoded root | P2 | Uses `PLATFORM_ROOT_DOMAIN`; unified shop strip | ✅ Fixed |
| R-08 | Custom admin ingress deferred (H-P6-03) | P2 | `admin.denali.club` in seed + smoke maps + web dev host resolver; prod Caddy in cutover runbook §2.5 | ✅ Dev + doc ready |
| R-09 | operator vs denali tenant confusion | P2 | Documented in host-subdomain-map | 📄 Doc |
| R-10 | guest-surface-host dist stale after TS change | P1 | Build before app tests | 🔧 Process |
| R-11 | Stale docs reintroduce shop canonical | P2 | `guard-wrs-stale-docs.mjs` | ✅ Fixed |
| R-12 | Custom apex cross-surface URLs wrong without env (`portal.denali.club` → marketing) | P1 | `tryParseCustomApexHost` in tenant-kernel builders | ✅ Fixed |
| R-13 | Duplicated portal URL logic web/marketing | P2 | `guest-surface-host/resolve-portal-public-base-url` | ✅ Fixed |
| R-14 | Web duplicates `fetchPublicTenantContextForHost` | P2 | web delegates to guest-surface-host | ✅ Fixed |
| R-15 | Partial prod env (marketing set, portal unset) | P2 | Custom apex step 5 + runbook env matrix | 📄 Doc |
| R-16 | Marketing reads member cookie / logged-in header | P0 | PCMS-001 — marketing anonymous; static portal link only | ✅ Fixed |
| R-17 | Cross-tenant cookie leak via platform `Domain=` | P0 | PCMS-COOK-01 — host-only on `{club}.{root}`; apex domain only on custom ingress | ✅ Fixed |
| R-18 | OTP skip in middleware (security / UX bypass) | P1 | Resume on register **page** server component only (`buildRegistrationResumeInitialState`) | ✅ Fixed |
| R-19 | Member session tenant/host mismatch | P0 | PCMS-SEC-01 — portal middleware bootstrap bind + clear cookie | ✅ Fixed |
| R-20 | Regressions re-introducing marketing session probe | P2 | `scripts/guards/guard-pcms-authority.mjs` in phase-6:fast-track | ✅ Fixed |
| R-21 | Portal middleware accepts forged JWT (decode-only) | P0 | PCMS-SEC-02 — `validateSessionTokenAsync` + RS256 verify when `AUTH_JWT_*` set | ✅ Fixed |
| R-22 | Unresolved host fail-open in production | P1 | `failClosedWhenUnresolved` when `ALLOW_DEV_WEB_SESSION` off | ✅ Fixed |
| R-23 | Custom apex E2E only on platform localhost | P2 | SMK-PTL-08 + `WRS_SMOKE_CUSTOM_APEX` + `test:smoke:custom-apex` | ✅ Fixed |

## File map (SoT)

| Concern | File |
| ------- | ---- |
| Host parse | `packages/tenant-kernel/src/host/parse-multi-level-tenant-host.ts` |
| Marketing URL egress | `packages/tenant-kernel/src/host/build-dev-marketing-public-base-url.ts` |
| Portal URL egress | `packages/tenant-kernel/src/host/build-dev-portal-public-base-url.ts` |
| Shared cross-app resolver | `packages/guest-surface-host/src/resolve-marketing-public-base-url.ts` |
| Portal URL egress | `packages/guest-surface-host/src/resolve-portal-public-base-url.ts` |
| Custom apex parse | `packages/tenant-kernel/src/host/parse-custom-apex-host.ts` |
| Member cookie domain | `packages/tenant-kernel/src/host/resolve-member-session-cookie-domain.ts` |
| Member session authority | `docs/standards/member-session-portal-authority.mdoc` |
| PCMS guard | `scripts/guards/guard-pcms-authority.mjs` |
| SEO canonical origin | `apps/marketing/src/seo/build-marketing-metadata.ts` |
| Web catalog redirect | `apps/web/src/marketing/resolve-marketing-public-url.ts` |
| Portal home redirect | `apps/portal/app/page.tsx` → guest-surface-host |
| Smoke URL constants | `packages/guest-surface-host/src/canonical-smoke-urls.ts` |
| Egress guard | `scripts/guards/guard-wrs-routing.mjs` |
| Architecture doc | `docs/phase-19/p6-host-addressing-architecture.mdoc` §5.4 |
