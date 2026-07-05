# Member Portal Shell — Repository Gap Report

**Status:** **PS-1..PS-7 REPO COMPLETE** · Architect sign-off **PENDING** · Committed on `DEV`  
**Date:** 2026-07-05 (closure pass)  
**Purpose:** Inventory **remaining** work after PS-1 through PS-6 implementation landing.

---

## 1. Executive summary

| Layer | Status |
| ----- | ------ |
| PS-1 Platform shell | ✅ Landed (committed `10f92ee6`) |
| PS-2 Member registry codegen | ✅ Landed (uncommitted) |
| PS-3 GSH URL builder | ✅ Landed (uncommitted) |
| PS-4 Cross-surface integration | ✅ Landed (uncommitted) |
| PS-5 Home + entitlements + dispatcher | ✅ Landed (uncommitted) |
| PS-6 Scale / embedded | ✅ Complete (bootstrap; mini-app bridge deferred) |
| PS-7 Cleanup (BP-8) | ✅ CL-01 + CL-03/04/05 (deprecated export + legacy shell CSS/DOM) |

**Implementation readiness:** **~92%** (PS-6 + PS-7 partial closed; governance + smoke remain).

**Verification (2026-07-05 closure):** `pnpm run guard:member-portal-shell` **6/6 PASS** · portal **150/150** unit · SDK **316/316** · API-ME-ENT-* **2/2** · SMK-PTL-09 **defined** (smoke env not run).

---

## 2. Closed gaps (PS-1..PS-6 — no action)

| Area | Evidence |
| ---- | -------- |
| Platform shell frame | `apps/portal/src/shell/*` · PS1-SHELL-* · `guard-member-shell` |
| `memberPortal` manifest + codegen | Denali manifest (+ hidden `wallet`) · generated registry |
| Registry-driven nav | `resolve-portal-member-nav.server.ts` · `guard-member-portal-registry` |
| GSH `resolvePortalMemberModuleUrl` | `packages/guest-surface-host` · GSH-PS3-* |
| `guestCrossSurfaceNav` marketing nav | `resolveMarketingShellNavLinks` · no `FULL_LANDING_NAV_LINKS` |
| Workspace registration egress | `context.memberModuleHref` (Denali + Urban) |
| Portal SEO | `robots.ts` · noindex on `/me/*` · `guard-member-seo` |
| Platform `home` module | `platform-member-portal-modules.ts` runtime merge |
| `/me/home` + aggregate BFF | `member-home-bff.server.ts` · `GET /api/me/home` |
| Entitlements BFF + API upstream | `GET /api/me/entitlements` → `GET /identity/me/entitlements` |
| Shell nav ∩ entitlements | `resolveMemberEntitlementsForShell` + nav filter |
| Module dispatcher | `app/me/[...modulePath]/page.tsx` · DL-21 unauthorized page |
| Portal `/` + bare `/me` registry redirect | `resolveMemberPortalDefaultRoutePath` |
| Tier entitlements + `denied[]` | Denali hidden `wallet` · `portalModuleGrants` metadata path |
| DL-21 static gates | home, registrations, profile, detail, `/me/more` |
| BFF cache + invalidation | 30s TTL · logout/profile/invalidate route |
| More hub | `/me/more` · DL-10 virtualised scroll at 25+ |
| L4 guest conformance | Denali L4 · `assertMemberPortalL4ReferenceWorkspaces` |
| Embedded host scaffold | GSH detect · `data-embedded-host` on shell |
| Logout unit test | MEM-AUTH-01 **150/150** green |

---

## 3. Open gaps (PS-7+)

### 3.1 Cleanup (PS-7 / BP-8)

| Item | Status |
| ---- | ------ |
| Remove `resolvePortalMemberAreaUrl` deprecated export | ✅ CL-01 (2026-07-05) |
| Legacy CSS dual selectors sunset | ✅ CL-03/04 shell root |
| SMK-PTL-05 update when default → `home` | Deferred until default changes |

### 3.2 Deferred product (post PS-6)

| Item | Phase | Notes |
| ---- | ----- | ----- |
| Telegram mini-app bridge | PS-7+ | Detect + attribute only today |
| BP-5 wallet/membership UI routes | Product | Hidden `wallet` entitlement path ready |
| Billing → `portalModuleGrants` webhook | BP-7 | Metadata write path exists |
| Hub windowing (50+ modules) | PS-7 | Scroll container at 25+ only |
| DL-12 `portalReturn` contract | Future | Not implemented |

### 3.3 Documentation / governance (Phase 0)

| Item | Status |
| ---- | ------ |
| Architect sign-off DL-01..42 | **PENDING SIGN-OFF** |
| RFC + WRS addendum PR merge | **PENDING SIGN-OFF** |
| Git commit PS-2..PS-7 work | ✅ `694620f0` |
| SMK-PTL-09 Playwright run | **DEFINED** — requires smoke env |

---

## 4. Intentional frozen URLs (not gaps)

| URL | Reason |
| --- | ------ |
| `/me/registrations` | Permanent alias (DL-03, DL-22) — `trips` module route |
| Smoke E2E `href="/me/registrations"` | Frozen URL regression bar |
| Registration detail back link `/me/registrations` | Alias to trips list |

---

## 5. Confirmed correct (audit reference)

- WRS three-app host/surface model
- Portal middleware on `/me/*` and `/api/me/*`
- Registration outside `/me/*` shell
- PCMS marketing anonymous session
- Profile BFF `GET/PATCH /api/me/profile`
- Member cookie `atour_mb_session` on portal host

---

## 6. Priority-ordered next work

| Priority | Work | Phase |
| -------- | ---- | ----- |
| P0 | Architect sign-off pack | 0 |
| P1 | SMK-PTL-09 in smoke env | PS-5/6 verification |
| P2 | BP-7 billing → `portalModuleGrants` | Product |

---

*Gap report v2.1.0 · PS-1..PS-6 closure · 2026-07-05*
