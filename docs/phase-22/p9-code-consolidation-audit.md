# P9 — Audit سخت‌گیرانه: code consolidation

```yaml
audit_id: P9-CODE-CONSOLIDATION-AUDIT
version: "1.1"
date: 2026-06-22
app_fit: p9-app-fit.md
method: code-first · dependency graph · enterprise monorepo boundary patterns
scope: apps/web · apps/marketing · apps/portal · packages/tenant-kernel · guards
prerequisite_context: P8 exit (ingress/session/env hardened) · P7 customer delivered
```

> **App fit (v1.1):** [p9-app-fit.md](p9-app-fit.md) — **~85% fits**; corrections: web keeps operator host map · catalog redirects stay · exit **≥8.7** not 9.5.

> **روش:** نمره بر اساس **یکپارچگی واقعی کد** — نه «redirect داریم پس تمام».  
> الهام: [Path to Project — multi-team Next.js boundaries](https://www.pathtoproject.com/blog/20260312-next-js-architecture-decisions-for-multi-team-enterprise-frontends) · [lastminute.com dependency-cruiser at scale](https://technology.lastminute.com/how-we-enforce-architecture-boundaries-at-scale-on-our-app/) · [Nx enforce-module-boundaries](https://nx.dev/docs/features/enforce-module-boundaries) · pnpm `workspace:*` shared kernel.

---

## نمره کلی (سفت)

| محور | نمره | معنی |
| ---- | ---: | ---- |
| **Guest bootstrap unity** | **3.0 / 10** | سه `resolve-host-tenant` · دو bootstrap تقریباً یکسان M+P · auth-env ناهماهنگ |
| **Surface boundary** | **3.5 / 10** | redirect هست؛ dead code ۱۱۰۰+ خط · web هنوز public-auth BFF کامل |
| **Auth / BFF dedup** | **2.0 / 10** | ۵ route کپی web↔portal · JWT helpers دوبل · orphan registration flow |
| **Package architecture** | **4.0 / 10** | `tenant-kernel` هست ولی web wrapper جدا · بدون `guest-surface` package |
| **Boundary enforcement** | **3.5 / 10** | `guard:import-boundary` workspace-level · **بدون** قانون «web ≠ portal BFF» |
| **میانگین** | **3.2 / 10** | consolidation enterprise **ناکافی** |
| **هدف P9 exit (fit)** | **≥ 8.7 / 10** | surface ≥9 · M+P bootstrap ≥9 |

---

## 1. Guest bootstrap unity

### آنچه درست است (+)

| # | مورد | شواهد |
| - | ---- | ----- |
| B+1 | `@app-tour/tenant-kernel` برای `parseMultiLevelTenantHost` | marketing · portal · api |
| B+2 | M+P هر دو `fetchPublicTenantContextForHost` → API | bootstrap files |
| B+3 | smoke tenant UUIDها sync با workspace seeds | `PHASE_43_HOST_TENANT_IDS` |
| B+4 | portal prod fail-closed vs marketing (P8 track) | `resolve-portal-bootstrap.ts` |

### شکاف‌های بحرانی (−)

| ID | Sev | شکاف | شواهد کد | استاندارد enterprise |
| -- | --- | ---- | -------- | --------------------- |
| G-BOOT-01 | **P0** | سه نسخه `resolve-host-tenant.ts` با host-kind متفاوت | web:55 · marketing:48 · portal:38 lines | یک shared dev host map در package |
| G-BOOT-02 | **P0** | `PHASE_43_HOST_TENANT_IDS` triplicate — drift risk (web alborz/urban-owner, portal نه) | هر سه فایل | Single source در `@app-tour/guest-surface-host` |
| G-BOOT-03 | **P0** | `resolvePluginIdForTenant` duplicate + `hostname.includes("denali")` | M+P bootstrap identical 34 lines | pluginId **100%** از API tenant-context در prod |
| G-BOOT-04 | **P1** | `auth-env` سه semantics: web بدون NODE_ENV · portal/marketing با NODE_ENV | `auth-env.ts` ×3 | یک `isDevGuestHostAllowed()` contract |
| G-BOOT-05 | **P1** | `fetch-public-tenant-context` triplicate (web server · M · P) | ۳ فایل | یک export از shared package |
| G-BOOT-06 | **P1** | `resolve-public-branding-host.ts` byte-identical M+P | diff empty | shared module |
| G-BOOT-07 | **P2** | web `resolve-multi-level-host.ts` wrapper جدا از tenant-kernel | web only | همه apps از kernel |
| G-BOOT-08 | **P2** | web `resolve-public-catalog-bootstrap.server.ts` — مسیر catalog legacy | 90 lines | حذف بعد از P9-1 surface cut |

### نمره جزئی bootstrap

| زیرمعیار | نمره |
| -------- | ---: |
| tenant-kernel adoption | 6 |
| Dev host map single source | 2 |
| M+P bootstrap DRY | 3 |
| pluginId from API (prod) | 4 |
| auth-env consistency | 2 |

---

## 2. Surface boundary (web vs portal/marketing)

### آنچه درست است (+)

| # | مورد | شواهد |
| - | ---- | ----- |
| S+1 | `/catalog/[tourId]/register` → redirect portal | `register/page.tsx` DEC-P11-014 |
| S+2 | catalog list/detail → redirect marketing | `catalog/page.tsx` · `[tourId]/page.tsx` |
| S+3 | portal = sole registration UX app | `apps/portal/app/catalog/` |
| S+4 | marketing = public tours surface | `:3002` |

### شکاف‌های بحرانی (−)

| ID | Sev | شکاف | شواهد | استاندارد enterprise |
| -- | --- | ---- | ----- | --------------------- |
| G-SURF-01 | **P0** | web هنوز **۵ route** `app/api/public-auth/*` فعال | middleware PUBLIC_BFF_API_PATHS | guest auth فقط portal |
| G-SURF-02 | **P0** | `public-catalog-registration-flow.tsx` **orphan** در web (563 خط — هیچ import) | grep zero refs | dead code = boundary violation |
| G-SURF-03 | **P1** | web layout هنوز `isPublicCatalogPath` + guest bootstrap | `app/layout.tsx:40-42` | catalog path bootstrap حذف |
| G-SURF-04 | **P1** | middleware `/catalog` public + public-auth whitelist | `middleware.ts:38-54` | web operator-only surface |
| G-SURF-05 | **P1** | `resolve-public-catalog-bootstrap.server.ts` + tests web-only | 90 lines + spec | migrate/remove |
| G-SURF-06 | **P2** | docs drift: `public-catalog.md` هنوز web OTP flow cite می‌کند | docs/workspaces/denali | doc sync P9-3 |
| G-SURF-07 | **P2** | e2e `denali-catalog-registration.spec.ts` on web filter | package.json scripts | portal-only e2e |

### نمره جزئی surface

| زیرمعیار | نمره |
| -------- | ---: |
| Redirect shims (DEC-P11-014) | 7 |
| Dead code removal | 1 |
| BFF route dedup | 2 |
| Middleware surface clarity | 4 |
| Doc/test alignment | 3 |

---

## 3. Auth / BFF session dedup

### آنچه درست است (+)

| # | مورد | شواهد |
| - | ---- | ----- |
| A+1 | portal registration flow refactored (`public-registration-logic`) | portal flow |
| A+2 | shared `@app-tour/ui-primitives` | both flows |
| A+3 | API `public/auth/*` single backend | apps/api |

### شکاف‌های بحرانی (−)

| ID | Sev | شکاف | شواهد | استاندارد enterprise |
| -- | --- | ---- | ----- | --------------------- |
| G-AUTH-01 | **P0** | ۵ public-auth BFF routes **near-identical** web↔portal (فقط api base import) | diff verify-otp | shared `@app-tour/public-auth-bff` handlers |
| G-AUTH-02 | **P0** | `decode-jwt-payload.ts` duplicate web+portal | 32 lines each | packages/session-client |
| G-AUTH-03 | **P0** | `validate-session-token.ts` duplicate | sync copy | shared + optional sig verify |
| G-AUTH-04 | **P1** | `read-public-catalog-session.server.ts` duplicate — portal workspaceId، web async/sync drift | web await validate · portal sync | one module |
| G-AUTH-05 | **P1** | `build-catalog-registration-headers.server.ts` duplicate — web urban headers vs portal generic | 28 vs 31 lines | shared guest headers |
| G-AUTH-06 | **P1** | `public-auth-bff-error.ts` duplicate | web · portal | shared |
| G-AUTH-07 | **P2** | web `resolve-identity-bff-tenant` → catalog bootstrap | web only | portal pattern only |
| G-AUTH-08 | **P2** | JWT decode **no signature verify** (documented) — duplicate doubles fix cost | both apps | central verify once |

### نمره جزئی auth

| زیرمعیار | نمره |
| -------- | ---: |
| Backend auth single | 8 |
| BFF route DRY | 1 |
| Session helpers DRY | 2 |
| Catalog headers DRY | 3 |
| Signature verify path | 2 |

---

## 4. Package architecture & boundaries

### آنچه درست است (+)

| # | مورد | شواهد |
| - | ---- | ----- |
| P+1 | `guard:import-boundary` + workspace-sdk boundary | scripts/guards |
| P+2 | `tenant-kernel` package with tests | packages/tenant-kernel |
| P+3 | generated theme/stylesheet per app (acceptable) | bootstrap generated |

### شکاف‌های بحرانی (−)

| ID | Sev | شکاف | شواهد | استاندارد enterprise |
| -- | --- | ---- | ----- | --------------------- |
| G-PKG-01 | **P0** | no `packages/guest-surface-host` (planned P9-0) | — | platform package · narrow API |
| G-PKG-02 | **P1** | no depcruise rule: `apps/web` forbidden `public-auth` routes post-P9 | guard scripts | architecture.rules per app |
| G-PKG-03 | **P1** | apps cross-import pattern via copy not workspace package | 3 apps | workspace:* deps |
| G-PKG-04 | — | `tenant_domains.surface` enforce | **P10** G-ING-04b | out of P9 |
| G-PKG-05 | **P2** | `build:operator-vps` omits M+P build | **P10** G-ENV-08 | not P9 |
| G-PKG-06 | **P3** | no package owner tags in turbo/nx style | — | governance doc |

### نمره جزئی package

| زیرمعیار | نمره |
| -------- | ---: |
| Shared kernel exists | 6 |
| Guest surface package | 0 |
| Boundary lint for surface | 3 |
| workspace:* adoption | 4 |
| Depcruise app-level rules | 3 |

---

## اقدامات (موج A/B/C)

### موج A — P0 (اول sprint P9)

| # | اقدام | Gap | فایل هدف |
| - | ----- | --- | -------- |
| A1 | Extract `packages/guest-surface-host` — dev host map · fetch tenant-context · branding host | G-BOOT-01/02/05/06 · G-PKG-01 | new package |
| A2 | M+P bootstrap → shared؛ حذف `resolvePluginIdForTenant` hostname hack prod | G-BOOT-03 | bootstrap files |
| A3 | Delete web `app/api/public-auth/*` + middleware paths + tests migrate portal | G-SURF-01 | web |
| A4 | Delete orphan `public-catalog-registration-flow.tsx` web | G-SURF-02 | web |
| A5 | Extract `packages/session-client` — decode-jwt · validate-session · cookie names | G-AUTH-02/03 | new package |

### موج B — P1

| # | اقدام | Gap |
| - | ----- | --- |
| B1 | Unify `auth-env` → `guest-surface-host/is-dev-guest-allowed` | G-BOOT-04 |
| B2 | Remove web catalog bootstrap stack (layout · resolve-public-catalog-bootstrap) | G-SURF-03/05 |
| B3 | Shared `build-catalog-registration-headers` + `read-public-catalog-session` | G-AUTH-04/05 |
| B4 | Shared public-auth BFF handler factory (portal consumes; web deleted) | G-AUTH-01/06 |
| B5 | depcruise/guard rule: web no `api/public-auth` · no guest registration components | G-PKG-02 |
| B6 | web `resolve-multi-level-host` → tenant-kernel only | G-BOOT-07 |

### موج C — P2+

| # | اقدام | Gap |
| - | ----- | --- |
| C1 | Doc sync `public-catalog.md` + smoke maps → portal | G-SURF-06 |
| C2 | e2e scripts: registration only `@apps/portal` | G-SURF-07 |
| C3 | ~~tenant_domains.surface~~ | **→ P10** G-ING-04b |
| C4 | `p9:gate` script + pack integrity spec | P9-3 |

---

## معیار exit P9 (سخت)

| # | Gate | ابزار |
| - | ---- | ----- |
| 1 | `resolve-host-tenant` copies = **0** in apps (only package) | ripgrep |
| 2 | web `app/api/public-auth` = **0** routes | glob |
| 3 | web orphan catalog flow = **0** lines | glob |
| 4 | M+P bootstrap import from `@app-tour/guest-surface-host` | depcruise |
| 5 | `guard:import-boundary` + new P9 surface rules green | CI |
| 6 | `p7:gate` + `p8:gate` regression | scripts |
| 7 | Re-score audit ≥ **9.5/10** composite | this doc |

---

## P8 overlap

| Gap | Owner |
| --- | ----- |
| G-PKG-04 surface enforce | **P10** G-ING-04b — not P9 |
| Cookie names / session | P8-1 — **before** P9 session-client |
| Marketing silent fallback | P8-0 — before guest-surface-host |

---

## References (external)

- [Next.js multi-team enterprise frontends](https://www.pathtoproject.com/blog/20260312-next-js-architecture-decisions-for-multi-team-enterprise-frontends)
- [Enforcing architecture boundaries at scale (dependency-cruiser)](https://technology.lastminute.com/how-we-enforce-architecture-boundaries-at-scale-on-our-app/)
- [Nx enforce module boundaries](https://nx.dev/docs/features/enforce-module-boundaries)
- [Turborepo boundaries](https://turbo.build/repo/docs/reference/configuration#boundaries)
- [pnpm workspace protocol](https://pnpm.io/workspaces#workspace-protocol-workspace)

---

## Internal

- [p9-app-fit.md](p9-app-fit.md)
- [p9-gap-registry.md](p9-gap-registry.md)
- [p9-action-plan.yaml](p9-action-plan.yaml)
- [p9-package-boundary.yaml](p9-package-boundary.yaml)
- [platform-code-consolidation.mdoc](platform-code-consolidation.mdoc)
- [p9-exit-checklist.md](p9-exit-checklist.md)
- [../POST-P7-PLATFORM-ROADMAP.md](../POST-P7-PLATFORM-ROADMAP.md)
- [../phase-21/p8-ingress-session-env-audit.md](../phase-21/p8-ingress-session-env-audit.md)
