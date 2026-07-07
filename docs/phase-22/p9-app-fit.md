# P9 — App fit: آیا به معماری ما می‌خورد؟

```yaml
doc_id: P9-APP-FIT
version: "1.0"
date: 2026-06-22
authority: p6-host-addressing-architecture.mdoc · p8-app-fit.md
pack: P9
verdict: MOSTLY_FITS_with_scope_corrections
prerequisite: P8 exit (Profile A+B)
```

> **خلاصه:** بله — **P9 به اپ می‌خورد** چون دقیقاً مشکل واقعی شماست: **web هنوز guest duplicate دارد** در حالی که معماری می‌گوید **portal = member · web = operator · marketing = public**.  
> ولی doc قبلی چند اشتباه scope داشت (حذف کامل catalog redirect · صفر کردن host map در web · ingress در P9).

---

## معماری واقعی → نقش P9

| Surface | App | P9 باید چه کند |
| ------- | --- | --------------- |
| **Operator** | `apps/web` :3000 | حذف **guest** BFF/dead code · **نگه‌داشتن** operator auth + dev admin host |
| **Member/guest** | `apps/portal` :3003 | تنها owner ثبت‌نام · public-auth BFF |
| **Public** | `apps/marketing` :3002 | bootstrap مشترک با portal · بدون session BFF |
| **Authority** | `apps/api` | pluginId از tenant-context — حذف heuristic در M+P |

**یک deploy · چند club:** P9 کد duplicate را کم می‌کند — **نه** infra جدید (→ P10).

---

## ✅ داخل P9 — مستقیماً fit

| کار | چرا |
| --- | --- |
| **حذف web `app/api/public-auth/*`** (G-SURF-01) | portal تنها guest auth — DEC-P11-014 |
| **حذف orphan `public-catalog-registration-flow.tsx`** (563 خط) | dead code واقعی |
| **حذف web catalog bootstrap** (`isPublicCatalogPath` layout branch) | redirect صفحات کافی |
| **M+P bootstrap dedup** (`fetch-public-tenant-context` · branding host) | دو app یکسان |
| **حذف `hostname.includes("denali")` pluginId** (G-BOOT-03) | API tenant-context |
| **`session-client` package** (web + portal) | هر دو JWT decode/validate |
| **`guest-surface-host` (فقط M+P import)** | dev host map + bootstrap مشترک |
| **guard: web forbidden public-auth** | enforce surface ownership |
| **doc/e2e → portal** | sync با معماری |

---

## ❌ خارج از P9 — اشتباه یا over-engineering

| مورد | اصلاح | چرا |
| ---- | ----- | --- |
| **حذف `/catalog` redirect pages در web** | **نگه دار** (307 → M/P) | legacy URL · DEC-P11-014 shim — نه UX |
| **`resolve-host-tenant.ts` = 0 در همه apps** | **فقط M+P = 0** · web نگه می‌دارد | web نیاز **operator** dev map (`club_admin` · login BFF) |
| **`guest-surface-host` در web import** | **ممنوع** | web operator-only |
| **`session-client` در marketing** | **نیاز نیست** | marketing anonymous SSR |
| **BFF handler factory cross-app** (P9-0-N-005) | **ساده‌سازی:** فقط portal internal module | بعد حذف web، یک app owner — factory اضافی |
| **catalog registration headers در guest package** | **portal-only** module | marketing نمی‌خواهد |
| **G-PKG-04 / tenant_domains.surface enforce** | **P10** (G-ING-04b) | ingress DB — نه P9 |
| **ادغام operator + guest auth** | **هرگز** | web `/api/auth/*` جدا از portal `/api/public-auth/*` |
| **exit 9.5 همه محور** | **~8.7–9 realistic** | scale فعلی ۴ app |

---

## سه app — مرز package (fit-aligned)

```text
packages/tenant-kernel     ← host grammar (already)
packages/guest-surface-host ← M+P bootstrap ONLY (new or tenant-kernel/guest)
packages/session-client      ← JWT helpers: web (operator) + portal (member)

apps/web
  ✅ session-client · tenant-kernel · operator resolve-host-tenant (local or operator-dev-host.ts)
  ❌ guest-surface-host · public-auth · catalog bootstrap

apps/marketing + apps/portal
  ✅ guest-surface-host
  portal also: session-client · public-auth routes (sole owner)
```

**گزینه سبک‌تر:** به‌جای package جدید، subpath `@app-tour/tenant-kernel/guest-bootstrap` — اگر guard اجازه دهد. هر دو fit؛ برای ۲ app **`guest-surface-host` justified** است.

---

## ترتیب P9 (fit-aligned)

### موج A — حتماً

1. حذف web public-auth BFF + middleware paths
2. حذف orphan registration flow
3. M+P → `guest-surface-host` (یا tenant-kernel guest)
4. حذف pluginId hostname hack
5. `session-client` برای web + portal

### موج B

1. حذف web catalog **bootstrap** (نه redirect pages)
2. auth-env unify **M+P only**
3. portal catalog session/headers **در portal** (یا guest package portal export)
4. web `resolve-multi-level-host` → tenant-kernel
5. guard p9-surface-boundary

### موج C

1. doc + e2e portal-only
2. `p9:gate`

**NOT P9:** custom domain ingress · TLS · urban product features

---

## Exit اصلاح‌شده

| محور | هدف realistic |
| ---- | ------------- |
| Surface boundary (web operator-only) | **≥ 9** |
| Guest bootstrap M+P dedup | **≥ 9** |
| Auth/BFF dedup | **≥ 8.5** |
| Package/guard | **≥ 8.5** |
| **Composite** | **≥ 8.7** (نه 9.5 اجباری) |

---

## وابستگی P8

| P8 first | Why |
| -------- | --- |
| P8 cookie rename | session-client constants |
| P8 portal middleware | قبل حذف web public-auth safety net |
| P8 marketing fail-closed | bootstrap package assumes no silent fallback |

---

## References

- [../POST-P7-PACK-ALIGNMENT.md](../POST-P7-PACK-ALIGNMENT.md)
- [AGENT-START.md](AGENT-START.md)
- [p8-app-fit.md](../phase-21/p8-app-fit.md)
- [p9-gap-registry.md](p9-gap-registry.md)
- [p9-package-boundary.yaml](p9-package-boundary.yaml)
- [p6-host-addressing-architecture.mdoc](../phase-19/p6-host-addressing-architecture.mdoc)
