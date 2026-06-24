# Post-P7 — Pack alignment (P8 · P9 · P10)

```yaml
doc_id: POST-P7-PACK-ALIGNMENT
version: "1.0"
date: 2026-06-22
authority: p8-app-fit.md · p9-app-fit.md · p10-app-fit.md
status: NORMATIVE
```

> **هدف:** یک منبع برای **تراز بودن** سه pack — مرز scope · مالک gap · exit · وابستگی · Profile A/B/C.

---

## 1. معماری مشترک (هر سه pack)

| ثابت | P8 | P9 | P10 |
| ---- | -- | -- | --- |
| ۴ پروسه api/web/marketing/portal | env/session/ingress | dedup کد | edge/TLS/smoke |
| یک VPS · یک deploy | ✅ | ✅ | ✅ |
| multi-club = host + tenantId | IP fallback · cookies | bootstrap package | DNS/subdomain HTTPS |
| web = operator · portal = guest | session جدا | حذف web guest BFF | admin subdomain HTTPS |
| marketing = public anonymous | fail-closed bootstrap | guest-surface-host | apex HTTPS |

**App fit per pack:** [p8-app-fit.md](phase-21/p8-app-fit.md) · [p9-app-fit.md](phase-22/p9-app-fit.md) · [p10-app-fit.md](phase-23/p10-app-fit.md)

---

## 2. ترتیب اجرا (ثابت)

```text
P7 sign-off → P8 (Profile A+B) → P9 (code) → P10 (Profile C)
```

| Blocker | چرا |
| ------- | --- |
| P9 قبل P8 | cookie rename · portal middleware · marketing fail-closed |
| P10 قبل P9 | web guest BFF روی admin apex خطرناک |
| P10 قبل P8 env | bootstrap 4-file در P8 Wave A/B |

**Overlap مجاز:** P7-0 items با tag `also-P8-A` (G-ING-01 · G-ENV-01) — کار را حذف نمی‌کند.

---

## 3. Exit scores (fit-aligned — یکسان)

| Pack | composite exit | محور خاص |
| ---- | -------------- | --------- |
| **P8** | Profile A ≥9 · Profile B session **≥8** · env **≥9** | ingress/session/env — **نه TLS** |
| **P9** | **≥ 8.7** | surface ≥9 · M+P bootstrap ≥9 |
| **P10** | **≥ 8.7** | TLS ≥8.5 · smoke 4/4 · Profile C staging |
| **Platform** (پس از هر سه) | **~8.8–9.0** | سقف strict ~9.2 |

---

## 4. Profile A / B / C — مالک تکمیل

| Profile | توضیح | مالک exit |
| ------- | ----- | --------- |
| **A** | dev `*.localhost` | **P8** |
| **B** | VPS IP HTTP `:3000–3003` | **P8** (P7 delivery) — **نگه داشته می‌شود** |
| **C** | HTTPS subdomain + optional M+P custom apex | **P10** |

```text
P8 completes:  A + B (session cap 8/10 on IP)
P10 completes: C staging wildcard + M+P custom (Wave C)
P10 does NOT:  deprecate B · admin custom apex (trunk v2)
```

---

## 5. Gap ownership — single owner (بدون ابهام)

### Ingress / tenant

| Gap | Owner | Pack |
| --- | ----- | ---- |
| G-ING-01 IP fallback API | P8 | P8-0 |
| G-ING-02 marketing silent fallback | P8 | P8-0 |
| G-ING-03 M+P bootstrap mismatch | P8 | P8-0 |
| G-ING-04a parser `club_*` kinds | P8 | P8-0 |
| G-ING-04b `tenant_domains.surface` DB enforce | **P10** | P10-0 Wave C |
| G-ING-05a loopback trust doc (lite) | P8 | P8-0 |
| G-ING-05b HTTPS forwarded-proto proof | **P10** | P10-1 |
| G-ING-06 pluginId heuristic | **P9** | P9-2 |
| G-ING-07 triplicate host map (M+P) | **P9** | P9-0 |

### Session / auth

| Gap | Owner | Pack |
| --- | ----- | ---- |
| G-SES-01/02 cookie rename (op vs member) | P8 | P8-1 |
| G-SES-03/05 JWT↔host fail-closed | P8 | P8-1 |
| G-SES-04/06 portal middleware | P8 | P8-1 |
| G-SES-07 `__Host-` prefix | **P10** | P10-1 (HTTPS only) |
| G-SES-09 web public-auth BFF | **P9** | P9-1 |
| session-client package | **P9** | P9-0 |

### Env / deploy

| Gap | Owner | Pack |
| --- | ----- | ---- |
| G-ENV-01..07 bootstrap/verify/README | **P8** | P8-2/3 |
| G-ENV-08 build:operator-vps npm | **P10** | P10-2 |
| G-DEP-01 health 4/4 | **P10** | P10-2 |
| G-DEP-02 GHA post-deploy smoke | **P10** | P10-2 |

**قانون carryover:** G-DEP-04/05 در P10 = **regression gate** اگر P8 بسته شده؛ **implement** فقط اگر P8 Wave B ناقص مانده.

### Code / surface

| Gap | Owner | Pack |
| --- | ----- | ---- |
| guest-surface-host | **P9** | P9-0 |
| web catalog redirect shims | **نگه** | هیچ pack حذف نمی‌کند |
| web operator resolve-host-tenant | **web local** | P9 فقط M+P را dedup می‌کند |

### TLS / ops / domain

| Gap | Owner | Pack |
| --- | ----- | ---- |
| G-TLS-01/02 Caddy + staging HTTPS | **P10** | P10-1 |
| G-TLS-03 on-demand TLS ask | **P10** | P10-0 Wave C |
| G-DOM-01 admin custom apex | **trunk v2** | خارج P10 exit |
| G-DOM-03 SMS | **waiver** | phase-18 |
| G-OPS-03 k8s prometheus | **waive VPS** | — |

---

## 6. SESSION_COOKIE_SECURE — dual profile (بدون تضاد)

| Profile | مقدار | Owner |
| ------- | ----- | ----- |
| B (IP HTTP) | `false` (یا unset) | P8 documented |
| C (HTTPS) | `true` | P10 smoke proven |

P8 portal parity = **همان contract per profile** — نه force true روی HTTP.

---

## 7. چک‌لیست تراز (review)

| # | سوال | باید |
| - | ------ | ----- |
| 1 | guest-surface-host در P8؟ | **خیر** → P9 |
| 2 | web public-auth حذف در P8؟ | **خیر** → P9 |
| 3 | TLS/Caddy در P8؟ | **خیر** → P10 |
| 4 | env 4-file implement کجا؟ | **P8** (P10 فقط regression) |
| 5 | tenant_domains.surface enforce کجا؟ | **P10** G-ING-04b (نه P9) |
| 6 | admin custom apex در P10 exit؟ | **خیر** → trunk v2 |
| 7 | Profile B بعد P10؟ | **باقی** + documented |
| 8 | exit 9.5 هر pack؟ | **خیر** → 8.7 fit (P8: B cap 8) |

---

## 8. Projection تجمعی (هم‌تراز با effort docs)

| بعد از | platform | apex HTTPS |
| ------ | -------- | ---------- |
| P7 | ~6.5 | ~3.4 |
| P8 | ~7.5–8.0 | ~4.5 |
| P9 | ~8.5 | ~5.0 |
| P10 | ~8.8–9.0 | ~8.7–9.0 |

---

## AI agent packs

| Pack | sole entry | gate token |
| ---- | ---------- | ---------- |
| P8 | [phase-21/AGENT-START.md](phase-21/AGENT-START.md) | `P8_PLATFORM_SURFACE_GATE_OK` |
| P9 | [phase-22/AGENT-START.md](phase-22/AGENT-START.md) | `P9_CODE_CONSOLIDATION_GATE_OK` |
| P10 | [phase-23/AGENT-START.md](phase-23/AGENT-START.md) | `P10_PRODUCTION_GRADE_GATE_OK` |

---

## References

- [POST-P7-PLATFORM-ROADMAP.md](POST-P7-PLATFORM-ROADMAP.md)
- [POST-P7-EFFORT-RANKING.md](POST-P7-EFFORT-RANKING.md)
- [phase-19/p6-host-addressing-architecture.mdoc](phase-19/p6-host-addressing-architecture.mdoc)
