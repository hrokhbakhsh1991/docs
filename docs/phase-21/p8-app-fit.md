# P8 — App fit: آیا به معماری ما می‌خورد؟

```yaml
doc_id: P8-APP-FIT
version: "1.0"
date: 2026-06-22
authority: p6-host-addressing-architecture.mdoc · P7-PORT-MATRIX
pack: P8
verdict: MOSTLY_FITS_with_scope_corrections
```

> **خلاصه:** بله — **بیشتر P8 به اپ شما می‌خورد**، ولی doc قبلی چیزهایی داشت که **به P9/P10 تعلق دارد** یا روی **Profile B IP** **غیرعملی** است. این فایل مرز درست را ثبت می‌کند.

---

## معماری واقعی اپ (ثابت — تغییر نمی‌دهیم)

| واقعیت | معنی برای P8 |
| -------- | ------------- |
| **۴ پروسه مشترک** (api · web · marketing · portal) | env parity و smoke چهار env — **درست** |
| **یک VPS / یک deploy** — نه deploy per club | P8 = رفتار host/session در **همان** stack |
| **aisolation = host + tenantId** — نه instance جدا | ingress API + bootstrap M+P — **درست** |
| **سه surface** (marketing · portal · admin web) | session جدا operator vs member — **درست** |
| **Profile B (P7):** IP + port `:3000–3003` | IP fallback API · cookie name جدا — **درست** |
| **Profile C (production):** `{club}.portal.{root}` + TLS | **بیشتر P10** — نه هدف exit کامل P8 |

مرجع: [p6-host-addressing-architecture.mdoc](../phase-19/p6-host-addressing-architecture.mdoc) · [P7-PORT-MATRIX](../phase-20/p7/appendices/P7-PORT-MATRIX.md)

---

## ✅ داخل P8 — مستقیماً به اپ می‌خورد

| Gap / کار | چرا fit |
| --------- | -------- |
| **G-ING-01** wire IP fallback در API | Profile B VPS — tenant-context روی IP |
| **G-ING-02** حذف marketing silent fallback | با معماری fail-closed ingress سازگار |
| **G-ING-03** M+P bootstrap یکسان (error نه silent vs throw) | همان chain `fetchPublicTenantContext` |
| **G-SES-01/02** نام cookie **متفاوت** web vs portal | روی **همان IP** پورت‌ها cookie share می‌کنند — تنها fix عملی بدون DNS |
| **G-SES-03/05** JWT `tenant_id` ↔ host tenant (fail-closed) | web middleware + portal — multi-club روی یک stack |
| **G-SES-04/06** portal middleware + SESSION_COOKIE_SECURE | HTTP VPS P7 |
| **G-ENV-01..05** bootstrap/verify 4 env | `remote-deploy.sh` همین مدل |
| **G-ING-04 (partial)** surface در **subdomain parser** (`club_portal` ≠ `club_apex`) | tenant-kernel — نه custom apex DB |

---

## ❌ خارج از P8 — قبلاً اشتباه در pack بود

| مورد | باید کجا باشد | چرا |
| ---- | -------------- | --- |
| **G-ING-06/07** pluginId heuristic · triplicate `resolve-host-tenant` | **P9** | dedup کد — نه ingress/session |
| **G-SES-09** حذف web `public-auth` BFF | **P9** | web → operator-only؛ guest فقط portal |
| **`packages/guest-surface-host`** (Wave B6 قدیمی) | **P9** | consolidation package |
| **G-SES-07** `__Host-` cookie prefix | **P10** (HTTPS) | `__Host-` **نیاز به Secure** دارد — روی HTTP Profile B **نامعتبر/بی‌فایده** |
| **G-ING-05** edge امضای enterprise برای `x-forwarded-host` | **P10** (+ doc سبک P8) | VPS فعلی: BFF→API **loopback**؛ API نباید از اینترنت reachable باشد |
| **G-ING-04 (full)** custom domain `tenant_domains.surface` | **P10** | trunk v1 custom فقط M+P — admin apex defer |
| **TLS · Caddy · cert renewal** | **P10** | — |
| **marketing `middleware.ts` کامل مثل web** | **نه لازم** | marketing anonymous SSR — **layout bootstrap** کافی؛ gate session در portal/web |

---

## ⚠️ محدودیت شناخته‌شده Profile B (IP)

```text
IP:3000 (admin) و IP:3003 (portal) = همان hostname
→ مرورگر cookie را per-host نگه می‌دارد، نه per-port
→ fix P8: نام cookie جدا (operator vs member)
→ isolation کامل session ≈ 8/10 روی IP — نه 10
→ برای ~9+ session: Profile C hostnames ({club}.admin.* vs {club}.portal.*) → P10
```

این **bug نیست** — محدودیت مدل staging شماست. P8 exit روی IP **≥8 session** واقع‌بینانه است.

---

## هدف exit اصلاح‌شده P8

| Profile | ingress | session | env | P8 exit؟ |
| ------- | ------: | ------: | --: | -------- |
| **A** dev `*.localhost` | ≥9 | ≥9 | ≥9 | ✅ |
| **B** VPS IP HTTP | ≥8 | **≥8** | ≥9 | ✅ (P7 delivery) |
| **C** subdomain HTTPS | partial | partial | ≥9 | **P10** completes |

**P8 north star (اصلاح):** Profile A + B **درست و fail-closed** — نه «HTTPS production کامل».

---

## موج‌های P8 (fit-aligned)

### موج A — حتماً برای اپ (P7 overlap OK)

1. API IP fallback (G-ING-01)
2. marketing بدون silent fallback (G-ING-02)
3. cookie name: `atour_op_session` / `atour_mb_session` — **بدون** `__Host-` روی HTTP
4. JWT↔host fail-closed web + portal
5. bootstrap + verify 4 env
6. portal SESSION_COOKIE_SECURE parity

### موج B — P8 واقعی

1. portal middleware
2. parser surface (`club_*` kinds) — نه custom apex DB
3. env contract verify
4. fail-fast startup (JWT · API URL · revalidate)
5. doc: API **127.0.0.1 only** on VPS (نه edge signing)

### موج C — P8 gate فقط

1. `p8:gate` · smoke Profile A+B
2. OWASP sign-off (scope Profile B cap documented)

**حذف از P8:** guest-surface package · web public-auth removal · __Host- cookies · custom apex SSL

---

## References

- [../POST-P7-PACK-ALIGNMENT.md](../POST-P7-PACK-ALIGNMENT.md)
- [platform-surface-hardening.mdoc](platform-surface-hardening.mdoc)
- [p8-gap-registry.md](p8-gap-registry.md)
- [p8-action-plan.yaml](p8-action-plan.yaml)
- [../phase-22/p9-code-consolidation-audit.md](../phase-22/p9-code-consolidation-audit.md)
- [../phase-23/p10-production-grade-audit.md](../phase-23/p10-production-grade-audit.md)
