# Member Portal Shell — Repository Gap Report

**Status:** **PENDING SIGN-OFF**  
**Date:** 2026-07-05  
**Source:** Blueprint v9, enterprise routing audit, routing verification pass (~90% confirmed)

**Purpose:** Inventory remaining repository work after **PS-1 partial landing** (2026-07-05). Facts verified against repo paths cited below.

---

## 1. Executive summary

Architecture review and routing verification are **complete**. The repository has **P6-3 member MVP** plus **PS-1 platform shell frame** (partial): `apps/portal/src/shell/*` wraps `/me/*` with header, bottom nav, and user menu; inline layout nav removed. **Still missing:** registry codegen (PS-2), GSH module resolver (PS-3), entitlements (PS-5+), cross-surface manifest nav.

**Implementation readiness:** see [readiness-report.md](./readiness-report.md) — **PS-1 landed 2026-07-05**; overall platform completion remains **~25%** (shell frame only).

---

## 2. Missing platform artifacts

### 2.1 Member portal manifest block

| Gap | Expected | Repo today |
| --- | -------- | ---------- |
| `memberPortal` in workspace manifest | Denali reference IA (Home platform-owned + workspace modules) | **Absent** from `packages/workspaces/denali/workspace.manifest.json` |
| Platform-owned `home` in effective registry | Merged at codegen — not in workspace manifest | **Not present** |
| Codegen `resolveMemberPortalModules(pluginId)` | Generated registry | **Not present** |
| Guest conformance L4 | Required block for member-app workspaces | **Not defined** in CI — DL-07, DL-18 |

**Blocks:** Phase 2+

### 2.2 Member entitlements endpoint

| Gap | Expected | Repo today |
| --- | -------- | ---------- |
| `GET /api/me/entitlements` | Portal BFF → API upstream (DL-09) | **No route** under `apps/portal/app/api/me/` |
| Entitlements mdoc | Response schema | **`platform-portal-member-entitlements.mdoc`** — contract skeleton |
| M17 allowlist extension | DL-31 | **Not extended** in `guard-public-catalog-m17.mjs` |

**Blocks:** Phase 5 nav gating

### 2.3 Member home aggregate

| Gap | Expected | Repo today |
| --- | -------- | ---------- |
| `GET /api/me/home` | BFF aggregate (DL-19) | **Not present** |
| `/me/home` route | Phase 4 module | **Not present** |

**Blocks:** Phase 4

---

## 3. Missing routing helpers

### 3.1 GSH member module URL

| Gap | Location | Today |
| --- | -------- | ----- |
| `resolvePortalMemberModuleUrl(host, moduleId?)` | `packages/guest-surface-host/` | **Missing** |
| Hardcoded alias | `resolve-portal-public-base-url.ts` L19–20 | `resolvePortalMemberAreaUrl` → `/me/registrations` always |

**Consumers affected:**

- `apps/marketing` footer/header member link (via GSH)
- `docs/standards/member-session-portal-authority.mdoc` references `resolvePortalMemberAreaUrl`
- Workspace registration success CTAs (see §5)

**Blocks:** Phase 3 (DL-22)

### 3.2 Portal default entry redirect

| Gap | Location | Today |
| --- | -------- | ----- |
| Registry-driven `/` redirect | `apps/portal/app/page.tsx` L12 | Hardcoded `/me/registrations` |

**Blocks:** Phase 4 (may partially land Phase 2 with static default)

### 3.3 Bare `/me` handler

| Gap | Location | Today |
| --- | -------- | ----- |
| `app/me/page.tsx` or middleware redirect | `apps/portal/app/me/page.tsx` | **Landed (PS-1 interim)** — `redirect("/me/registrations")` (DL-40 until PS-2 registry default) |

**Blocks:** Phase 2 (registry-owned default primary module)

### 3.4 Dynamic module dispatcher

| Gap | Expected | Today |
| --- | -------- | ----- |
| `app/me/[[...modulePath]]/page.tsx` | Phase 5+ scale | **Not present** — static folders only |

**Blocks:** Phase 5+ (expected gap)

---

## 4. Hardcoded URLs (routing audit verified)

| Location | Hardcoded value | Target |
| -------- | --------------- | ------ |
| `packages/guest-surface-host/src/resolve-portal-public-base-url.ts` L19–20 | `/me/registrations` | `resolvePortalMemberModuleUrl` |
| `apps/portal/app/page.tsx` L12 | `/me/registrations` | `defaultPrimaryModuleId` |
| `apps/portal/src/shell/*` (PS-1 static nav) | `/me/registrations`, `/me/profile` in shell slots | Registry-driven labels/URLs (PS-2) |
| `packages/workspaces/denali/src/catalog/registration-flow/denali-registration-flow.steps.tsx` L361 | `href="/me/registrations"` | Injected GSH URL |
| `packages/workspaces/urban/src/catalog/registration-flow/urban-registration-flow.steps.tsx` L154 | `href="/me/registrations"` | Injected GSH URL |
| `apps/marketing/src/shell/marketing-shell.tsx` L21–26 | `FULL_LANDING_NAV_LINKS` static paths | `guestCrossSurfaceNav` manifest |

---

## 5. Missing noindex strategy (portal SEO)

| Gap | Marketing (reference) | Portal today |
| --- | --------------------- | ------------ |
| `robots.ts` | `apps/marketing/app/robots.ts` | **Absent** |
| `/me/*` noindex | N/A on marketing | **No metadata policy** |
| `/catalog/*/register` noindex | N/A | **No metadata policy** |
| `/api/*` disallow | Marketing disallows `/api/` | **No portal robots** |

**Decision:** DL-39  
**Blocks:** Phase 3 documentation gate; implementation may land Phase 1 or 3

---

## 6. Legacy aliases and routing drift

### 6.1 WRS §4 lag (documented — not code bug)

WRS-001 §4.2 omits paths present in repo:

- `/me/profile`
- Locale marketing paths
- Web register shim
- Operator `/tours/{id}/register`

**Remediation:** [wrs-portal-member-routing-addendum.mdoc](../../standards/wrs-portal-member-routing-addendum.mdoc) — DL-41

### 6.2 Marketing nav → 404 on club hosts

| Path | Behavior | Evidence |
| ---- | -------- | -------- |
| `/about`, `/contact` | Linked in `FULL_LANDING_NAV_LINKS` | `about/page.tsx` → `notFound()` unless platform-mother |

**Remediation:** DL-37 manifest admission — Phase 3

### 6.3 Operator broken alias

| Path | Status |
| ---- | ------ |
| `(app)/settings/tour-form-defaults` | In operator route parity inventory — **no live page** |

Out of member shell scope; noted for operator nav hygiene.

### 6.4 Web catalog redirect flag

| Env | Effect |
| --- | ------ |
| `MARKETING_CATALOG_REDIRECT=false` | Disables web → marketing catalog redirect |

Verified: `apps/web/src/marketing/resolve-marketing-public-url.ts`, test `WEB-MKT-06`.

---

## 7. Missing cross-surface manifest

| Artifact | Status |
| -------- | ------ |
| `guestCrossSurfaceNav` schema | **Documented** in `guest-cross-surface-nav-schema.mdoc` — JSON Schema update pending impl PR |
| Marketing shell driven by manifest | **Hardcoded** `FULL_LANDING_NAV_LINKS` |
| Codegen validation for surface allowlist | **Not implemented** |

**Blocks:** Phase 3 (DL-05)

---

## 8. Shell platform frame gaps

| Component | Status |
| --------- | ------ |
| Platform portal shell (header, bottom nav, user menu) | **Landed (PS-1 partial)** — `apps/portal/src/shell/*`; inline nav removed from `me/layout.tsx` |
| Shell modes (minimal vs full) | **Partial** — registration page outside `me/layout` (no bottom nav); explicit minimal-shell contract still doc-only |
| `[data-portal-shell]` landmarks | **Landed (PS-1)** — dual legacy `[data-portal-member-shell]` + header/main/bottom-nav hooks |
| Bare `/me` default route | **Landed (PS-1 interim)** — `app/me/page.tsx` redirects to `/me/registrations` (DL-40 until PS-2) |
| Member logout in shell user menu | **Landed** — `portal-member-user-menu.tsx` preserves `data-public-auth-logout` (SMK-PTL-06) |
| Registry-driven nav / hub | **Not implemented** — static Phase-1 links only (PS-2+) |

**Blocks:** Phase 2 (PS-2 registry codegen)

---

## 9. Guards and smoke gaps

| Item | Status |
| ---- | ------ |
| `guard-member-portal-registry` script | **Spec only** — [guard-member-portal-registry.md](../../dev/guard-member-portal-registry.md) |
| `guard-guest-cross-surface-nav` | **Not specified in repo scripts** |
| SMK-PTL-09 (entitlements nav) | **Not defined** |
| Entitlements integration tests | **Absent** |

---

## 10. Documentation gaps (closing with this promotion)

| Document | Before promotion | After promotion |
| -------- | ---------------- | --------------- |
| Official RFC | Blueprint in `docs/temp/` only | `platform-portal-member-shell-architecture.mdoc` |
| WRS addendum | WRS §4 incomplete | `wrs-portal-member-routing-addendum.mdoc` |
| Decision log DL-01..42 | Blueprint §15 only | `member-portal-shell/decision-log.mdoc` |
| Implementation gates | Blueprint §45 | `member-portal-shell/implementation-gates.mdoc` |
| Guard spec | Blueprint mentions | `docs/dev/guard-member-portal-registry.md` |
| Entitlements mdoc | Referenced as future | **Still missing** — Phase 5 prerequisite |

---

## 11. Routing verification confirmed items (no gap — keep)

These are **implemented correctly** per audit:

- WRS host/surface three-app model
- Portal middleware protects `/me/*` and `/api/me/*`
- Registration at `/catalog/{tourId}/register` outside `/me`
- No portal `/tours`
- PCMS: marketing does not read member session
- Marketing public catalog at `/tours`
- Web operator `/tours` distinct from marketing
- SMK-PTL-01..08 scenarios exist and cover frozen URLs
- Profile BFF landed (`GET/PATCH /api/me/profile`)
- Member session cookie `atour_mb_session` on portal host

---

## 12. Priority-ordered remediation

| Priority | Gap | Phase | Owner surface |
| -------- | --- | ----- | ------------- |
| P0 | Architect sign-off DL-01..42 | 0 | Docs |
| P0 | Merge RFC + WRS addendum | 0 | Docs |
| P1 | Platform shell frame | 1 | `apps/portal` |
| P1 | Bare `/me` redirect | 1 | `apps/portal` |
| P2 | `memberPortal` manifest + codegen | 2 | `workspace-sdk`, Denali manifest |
| P3 | GSH `resolvePortalMemberModuleUrl` | 3 | `guest-surface-host` |
| P3 | `guestCrossSurfaceNav` + marketing shell | 3 | manifest, marketing |
| P3 | Portal robots/noindex | 3 | `apps/portal` |
| P3 | Workspace registration egress injection | 3 | workspace packages |
| P4 | `/me/home` + `/` registry redirect | 4 | portal |
| P5 | Entitlements BFF + dispatcher | 5 | portal, API |

---

*Gap report v1.0.0 · Status: PENDING SIGN-OFF · Facts sourced from repo inspection 2026-07-05*
