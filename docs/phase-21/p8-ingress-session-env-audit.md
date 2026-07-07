# P8 — Audit سخت‌گیرانه: ingress · session · env

```yaml
audit_id: P8-INGRESS-SESSION-ENV-AUDIT
version: "1.2"
app_fit: p8-app-fit.md
prerequisite_context: P7 not exit · shared 4-process VPS · Profile A+B scope
```

> **روش:** نمره بر اساس **stack مشترک ۴ پروسه** + Profile A/B — نه HTTPS production (→ P10).  
> **Fit:** [p8-app-fit.md](p8-app-fit.md) — موارد ناسازگار با اپ از pack خارج شدند.

---

## App fit verdict

| | |
| --- | --- |
| **می‌خورد؟** | **بله (~85%)** — ingress/session/env روی host-based multi-tenant |
| **خارج شد از P8** | guest-surface package · web public-auth · __Host- cookies · custom apex SSL · edge signing |
| **محدودیت IP** | session روی Profile B سقف **~8** — نه 10 |

---

## نمره کلی (سفت)

| محور | نمره | معنی |
| ---- | ---: | ---- |
| **Ingress** | **3.5 / 10** | مدل host در kernel خوب؛ مسیر API و IP staging شکسته یا ناقص |
| **Session** | **2.5 / 10** | cross-surface روی IP · bind tenant در prod fail-open · portal بدون gate |
| **Env** | **3.5 / 10** | چهار فایل doc هست؛ bootstrap/verify ناقص · drift نام متغیر |
| **میانگین سه محور** | **3.2 / 10** | برای enterprise multi-tenant **ناکافی** |
| **تک‌club + subdomain (Profile C)** | **~5.5 / 10** | با DNS درست و یک tenant قابل تحویل P7 |
| **هدف P8 exit (Profile A)** | **≥ 9 / 10** | هر محور |
| **هدف P8 exit (Profile B IP)** | **≥ 8 / 10** | session cap — همان hostname |
| **هدف کامل HTTPS** | — | **P10** |

---

## 1. Ingress

### آنچه درست است (+)

| # | مورد | شواهد |
| - | ---- | ----- |
| I+1 | گرامر host مشترک (`club_apex` · `club_portal` · `club_admin`) | `packages/tenant-kernel/.../parse-multi-level-tenant-host.ts` |
| I+2 | API `x-forwarded-host` را بر `Host` ترجیح می‌دهد | `apps/api/src/http/read-ingress-host.ts` |
| I+3 | مسیر custom domain در DB | `tenant_domains` · `resolveTenantFromCustomDomainHost` |
| I+4 | `site_surfaces` در tenant-context | `read-tenant-site-surfaces.ts` |
| I+5 | تست parity سه host | `smoke-p6-host-bind.mjs` · `p6-host-tenant-parity.spec.ts` |
| I+6 | helper fallback IP **نوشته شده** (ولی wire نشده) | `resolve-public-tenant-label-from-host.ts` |

### شکاف‌های بحرانی (−)

| ID | Sev | شکاف | شواهد کد | استاندارد enterprise |
| -- | --- | ---- | -------- | --------------------- |
| G-ING-01 | **P0** | `handlePublicTenantContext` از `resolvePublicIngressSubdomain` استفاده می‌کند — **نه** `resolvePublicTenantLabelFromIngressHost` → IP = `TENANT_HOST_UNKNOWN` | `tenant-branding.routes.ts:208-211` | Tenant فقط از منبع tamper-proof (edge/JWT/subdomain verified) — OWASP MT |
| G-ING-02 | **P0** | marketing در prod وقتی API 404 → **silent fallback** به smoke tenant | `resolve-marketing-bootstrap.ts:54-55` | هرگز tenant از client/heuristic بدون verify — Docsie/OWASP |
| G-ING-03 | **P1** | portal در prod → `PORTAL_TENANT_UNRESOLVED` throw | `resolve-portal-bootstrap.ts:60` | رفتار درست‌تر از marketing ولی بدون fix API یکسان نیست |
| G-ING-04 | **P1** | `tenant_domains.surface` در ingress **enforce نمی‌شود** | `resolve-public-ingress-subdomain.ts` | apex marketing vs portal.admin باید surface match کند |
| G-ING-05 | **P1** | `x-forwarded-host` بدون edge امضا — هر BFF می‌تواند tenant جعل کند اگر API از اینترنت reachable باشد | BFF pattern | Edge injects verified tenant — SystemsHardening |
| G-ING-06 | ~~P2~~ | pluginId heuristic | **P9** | bootstrap — not P8 |
| G-ING-07 | ~~P2~~ | triplicate resolve-host-tenant | **P9** | shared package |
| G-ING-08 | **P2** | `TOUR_OPS_PUBLIC_FALLBACK_HOSTS` در env.example — **در کد M+P خوانده نمی‌شود** | `marketing.env.example` vs `resolve-public-host-fallback.ts` (web only) | twelve-factor: env = contract |

### نمره جزئی ingress

| زیرمعیار | نمره |
| -------- | ---: |
| مدل canonical subdomain | 7 |
| API public routes production | 3 |
| IP / Profile B staging | 2 |
| Custom domain + surface | 3 |
| Anti-spoof / edge trust | 4 |
| کد یکپارچه M+P/web | 4 |

---

## 2. Session

### آنچه درست است (+)

| # | مورد | شواهد |
| - | ---- | ----- |
| S+1 | `HttpOnly` + `SameSite=Lax` + `Path=/` | `build-session-cookie.ts` |
| S+2 | `platform_session` جدا از operator | web middleware |
| S+3 | JWT شامل `tenant_id` · portal validate می‌کند | `validate-session-token.ts` |
| S+4 | web روی mismatch کوکی را clear می‌کند (dev path) | `middleware.ts` · `AUTH_TENANT_HOST_MISMATCH` |
| S+5 | بدون `Domain=` روی cookie — subdomain isolation بهتر | no Domain attribute |

### شکاف‌های بحرانی (−)

| ID | Sev | شکاف | شواهد کد | استاندارد enterprise |
| -- | --- | ---- | -------- | --------------------- |
| G-SES-01 | **P0** | نام cookie یکسان: `session` web + portal | هر دو `SESSION_TOKEN_COOKIE = "session"` | نام جدا per surface · OWASP: avoid same name cross-app on same host |
| G-SES-02 | **P0** | روی **همان hostname** (IP خام) پورت‌ها cookie را share می‌کنند — مرورگر port را جدا نمی‌کند | IP:3000 vs :3003 | اپراتور session روی member app یا برعکس — Security.SE #15734 |
| G-SES-03 | **P0** | `sessionTenantMatchesHost` در **production fail-open** (`expected === null` → true) | `session-host-binding.ts:44-47` | JWT tenant باید با host-resolved tenant match شود — OWASP MT |
| G-SES-04 | **P1** | portal **بدون middleware** — فقط layout `/me` redirect | `app/me/layout.tsx` | middleware زودهنگ + host bind |
| G-SES-05 | **P1** | portal JWT `tenant_id` را با bootstrap host **compare نمی‌کند** | `/me` فقط session null check | cross-tenant member اگر cookie leak |
| G-SES-06 | **P1** | portal `SESSION_COOKIE_SECURE` env **نادیده** — `NODE_ENV===production` → Secure حتی وقتی example می‌گوید false | portal vs web `resolveSessionCookieSecure` | HTTP VPS staging شکسته |
| G-SES-07 | **—** | ~~`__Host-` prefix~~ → **P10** (needs HTTPS Secure) | — | Profile B: rename cookies only |
| G-SES-08 | **P3** | `SameSite=Lax` نه Strict برای admin | both apps | optional |
| G-SES-09 | **—** | web `public-auth` duplicate | **P9** | portal sole guest |

### نمره جزئی session

| زیرمعیار | نمره |
| -------- | ---: |
| Cookie attribute baseline | 6 |
| Cross-surface isolation (IP) | 1 |
| Tenant bind JWT↔host (prod) | 2 |
| Portal gate depth | 2 |
| OWASP __Host- / Strict | 1 |
| Operator vs member separation | 3 |

---

## 3. Env

### آنچه درست است (+)

| # | مورد | شواهد |
| - | ---- | ----- |
| E+1 | چهار `*.env.example` جدا | `deploy/vps/env/` |
| E+2 | `verify-env-coherence.sh` web↔api port | script exists |
| E+3 | `sync-web-api-url-port.sh` در deploy | `remote-deploy.sh` |
| E+4 | secrets doc: JWT · revalidate · DATABASE | api.env.example |
| E+5 | Profile A/B/C در P7-PORT-MATRIX | doc |

### شکاف‌های بحرانی (−)

| ID | Sev | شکاف | شواهد | استاندارد enterprise |
| -- | --- | ---- | ----- | --------------------- |
| G-ENV-01 | **P0** | `bootstrap-server.sh` فقط `api.env` + `web.env` | lines 53-62 | four-process = four templates on bootstrap |
| G-ENV-02 | **P1** | `verify-env-coherence` فقط web — marketing/portal/`MARKETING_REVALIDATE_*` چک نمی‌شود | `verify-env-coherence.sh` | config drift gate — HashiCorp/Vault pattern: validate all deps |
| G-ENV-03 | **P1** | drift نام: `PUBLIC_TENANT_*` (api) vs `TOUR_OPS_PUBLIC_*` / `TOUR_OPS_DEFAULT_*` (web) vs unread (M+P) | env examples | یک contract YAML · twelve-factor |
| G-ENV-04 | **P1** | `portal.env` JWT keys commented — BFF بدون verify ممکن است | portal.env.example | fail-fast startup if JWT missing |
| G-ENV-05 | **P2** | `remote-deploy` restart M+P **conditional** on env file exists | easy to forget portal |
| G-ENV-06 | **P2** | no startup `config validate` command per app | — | `pnpm run config:check` pattern (Stripe-style) |
| G-ENV-07 | **P2** | README بالا هنوز 2-URL — cognitive drift | deploy/vps/README top | |
| G-ENV-08 | **P3** | `package.json build:operator-vps` ≠ `build-operator-vps.sh` | root package.json | |

### نمره جزئی env

| زیرمعیار | نمره |
| -------- | ---: |
| Env file separation | 6 |
| Bootstrap completeness | 3 |
| Automated coherence | 4 |
| Naming contract | 3 |
| Fail-fast validation | 2 |
| Secret sync story | 5 |

---

## اقدامات (ترتیب اجرا — P8)

### موج A — P0 (قبل prod دوم · می‌تواند blocker P7 Profile B باشد)

| # | اقدام | Gap | فایل هدف |
| - | ----- | --- | -------- |
| A1 | Wire `resolvePublicTenantLabelFromIngressHost` در `handlePublicTenantContext` + branding | G-ING-01 | `tenant-branding.routes.ts` |
| A2 | حذف silent smoke fallback marketing در `NODE_ENV=production` | G-ING-02 | `resolve-marketing-bootstrap.ts` |
| A3 | Cookie names جدا: `atour_op_session` · `atour_mb_session` (**بدون** __Host- روی HTTP) | G-SES-01/02 | web + portal cookie builders |
| A4 | Production tenant bind: JWT `tenant_id` === API-resolved tenant for host (fail-closed) | G-SES-03/05 | web middleware · portal middleware جدید |
| A5 | bootstrap + verify چهار env | G-ENV-01/02 | `bootstrap-server.sh` · `verify-env-coherence.sh` |
| A6 | portal `SESSION_COOKIE_SECURE` مثل web | G-SES-06 | `portal/build-session-cookie.ts` |

### موج B — P1 (P8 EPIC کامل)

| # | اقدام | Gap |
| - | ----- | --- |
| B1 | portal `middleware.ts` — session + host bind + maintenance |
| B2 | enforce parser surface (`club_portal` vs `club_apex`) — **not** custom apex DB | G-ING-04a |
| B3 | env contract: `p8-env-contract.yaml` + verify | G-ENV-03 |
| B4 | startup fail-fast: JWT / TOUR_OPS_API_URL / revalidate | G-ENV-04 |
| B5 | marketing/portal bootstrap error parity | G-ING-03 |
| B6 | doc: API 127.0.0.1 on VPS · BFF forwards host | G-ING-05a |

### موج C — P8 gate only (P9/P10 items removed)

| # | اقدام | Gap |
| - | ----- | --- |
| C1 | `p8:gate` + Profile A/B smoke | P8-3 |
| C2 | deploy README four-process | G-ENV-07 |
| C3 | CI verify-env-coherence on deploy/ PR | P8-3 |

**Moved out of P8:** C1-old web public-auth (→ P9) · guest-surface package (→ P9) · edge signing (→ P10) · __Host- cookies (→ P10)

---

## معیار exit P8 (سخت)

| # | Gate | ابزار |
| - | ---- | ----- |
| 1 | IP + subdomain هر سه app tenant-context 200 | smoke script |
| 2 | Cookie `session` دیگر cross-port روی IP share نشود | manual + e2e |
| 3 | JWT tenant mismatch → 401/403 + clear cookie | spec |
| 4 | `verify-env-coherence --all` در `p7:staging-gate` | script |
| 5 | bootstrap creates 4 env | integration test |
| 6 | OWASP checklist MT-01..05 doc sign-off | p8-exit-checklist |

---

## References (external)

- [OWASP Multi Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Multi-Tenancy Security Patterns (Systems Hardening)](https://www.systemshardening.com/articles/cross-cutting/multi-tenancy-security-patterns/)
- [Session cookie subdomain isolation (Security StackExchange)](https://security.stackexchange.com/questions/15734/is-my-current-method-of-handling-session-cookies-insecure)

---

## Internal

- [p8-app-fit.md](p8-app-fit.md)
- [p8-gap-registry.md](p8-gap-registry.md)
- [p8-action-plan.yaml](p8-action-plan.yaml)
- [p8-env-contract.yaml](p8-env-contract.yaml)
- [platform-surface-hardening.mdoc](platform-surface-hardening.mdoc)
- [p8-exit-checklist.md](p8-exit-checklist.md)
- [../POST-P7-PLATFORM-ROADMAP.md](../POST-P7-PLATFORM-ROADMAP.md)
