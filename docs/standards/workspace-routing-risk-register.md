# WRS Risk Register — mitigations applied

**Updated:** 2026-07-12

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

---

## Surface cohesion (PSC-001)

**Authority:** [platform-surface-cohesion.mdoc](./platform-surface-cohesion.mdoc) · **Guards:** `guard:surface-cohesion` · `guard:surface-cohesion-smoke` · **Smoke matrix:** `docs/dev/platform-surface-cohesion-smoke-matrix.yaml`

### Gap register (closed / accepted)

| ID | Risk | Severity | Mitigation | Status |
| -- | ---- | -------- | ---------- | ------ |
| PSC-C-01 | Web `urban-api-base.ts` ≠ GSH API URL chain | P1 | Phase 1a — re-export shim | ✅ Fixed (2026-07-12) |
| PSC-C-02 | Web hostname plugin heuristics (`denali.` / `urban.`) | P1 | Phase 1c — `resolveDevPluginIdForTenantId` | ✅ Fixed (2026-07-12) |
| PSC-C-03 | Web branding bypass GSH (server + BFF route) | P1 | Phase 1b — delegate `fetchPublicTenantBrandingForHost` (server + `/api/public/tenant-branding`) | ✅ Fixed (2026-07-12) |
| PSC-C-04 | guest-club missing explicit `operatorCapabilities` row | P2 | Phase 2 — manifest + regenerate | ✅ Fixed (2026-07-12) |
| PSC-C-05 | Admin session bind fail-open vs portal fail-closed | P2 | Phase 4 — prod ingress-bound only (intentional) | 📄 Accepted |
| PSC-C-06 | starter throws on guest landing | P2 | Phase 4 — admin scaffold; use urban/guest-club for guest | 📄 Accepted |
| PSC-C-07 | SDK/GSH dist stale after TS change | P2 | `build:workspace-sdk-for-guards` + GSH build | ✅ Documented |
| PSC-C-08 | Cross-surface smoke matrix incomplete | P2 | Phase 3 — extend SMK-* | ✅ Fixed (2026-07-12) |
| PSC-C-09 | Web duplicate `apiBaseUrl()` in tenant-context | P1 | Phase 1a — shared resolver | ✅ Fixed (2026-07-12) |
| PSC-C-10 | 50+ `@/urban/urban-api-base` imports — need shim not mass-rename | P1 | Phase 1a — shim file | ✅ Fixed (2026-07-12) |
| PSC-C-11 | `denali-wizard-labels.ts` composite id prefix — not hostname (intentional) | P2 | N/A — not routing cohesion | 📄 Doc |
| PSC-C-12 | Web hardcoded `/denali/catalog` API paths | P1 | Phase 1d — SDK `resolveCatalog*ApiPath` | ✅ Fixed (2026-07-12) |
| PSC-C-13 | `DEV_HOST_SESSION_PROFILES` hardcoded in tenant-kernel.server | P2 | Phase 2 — `dev-host-session-profiles.ts` SoT | ✅ Fixed (2026-07-12) |
| PSC-C-14 | `WEB-8.2-04` test encodes stricter web API policy | P1 | Phase 1a — doc + test update | ✅ Fixed (2026-07-12) |
| PSC-C-15 | Web missing `assertGuestBffProductionConfig` before branding fetch | P1 | Phase 1b — `onBeforeFetch` in server helper (covers BFF route) | ✅ Fixed (2026-07-12) |
| PSC-C-16 | UI `workspaceType === "denali"` capability checks | P2 | Phase 2 — `fieldExposureSurfaces` + wizard draft reader via codegen surface | ✅ Fixed (2026-07-12) |
| PSC-C-17 | Duplicate workspace manifest guard vs certification | process | Extend `guard-workspace-certification` | ✅ Fixed (2026-07-12) |
| PSC-C-18 | SMK-COHESION overlap with existing smoke | process | Extend SMK-PTL/MKT/WRS smoke | ✅ Fixed (2026-07-12) |

### Cohesion execution risks

| ID | Risk | Severity | Mitigation | Status |
| -- | ---- | -------- | ---------- | ------ |
| PSC-R-01 | Dev web API policy change when unifying to GSH fallback | M | Phase 1a doc freeze + update WEB-8.2-04 | ✅ Fixed (2026-07-12) |
| PSC-R-02 | Mass-rename `urban-api-base` imports | H | Permanent shim re-export | 📄 Doc |
| PSC-R-03 | Remove heuristics before codegen map ready | H | Phase 1c after 1a green | ✅ Fixed (2026-07-12) |
| PSC-R-04 | Strict session bind breaks unmapped dev admin clubs | M | Phase 3+ scoped to prod | 📄 Doc |
| PSC-R-05 | New workspace breaks on hardcoded catalog clients | M | Phase 1d SDK paths | ✅ Fixed (2026-07-12) |
| PSC-R-06 | Phase 1 PR too large | M | Sub-phases 1a→1d separate PRs | 📄 Doc |
| PSC-R-07 | Doc covenant bypass on web tenant edits | H | Phase 0 blocking | ✅ Active |
| PSC-R-08 | Guard strict mode before debt cleared | M | Default warn; strict after 1c | ✅ Active |

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
| Surface cohesion | `docs/standards/platform-surface-cohesion.mdoc` |
| Cohesion guard | `scripts/guards/guard-surface-cohesion.mjs` |
| Cohesion smoke matrix | `docs/dev/platform-surface-cohesion-smoke-matrix.yaml` |
| Cohesion smoke guard | `scripts/guards/guard-surface-cohesion-smoke.mjs` |
| PSC fast-track | `pnpm run phase-psc:fast-track` |
| Architecture doc | `docs/phase-19/p6-host-addressing-architecture.mdoc` §5.4 |
