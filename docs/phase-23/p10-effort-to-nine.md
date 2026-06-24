# P10 — فاصله تا ۹/۱۰: تحلیل کار و کمبودها (سخت)

```yaml
doc_id: P10-EFFORT-TO-NINE
version: "1.0"
date: 2026-06-22
verdict: P10_hardest_path_to_nine
audit: p10-production-grade-audit.md
ranking: docs/POST-P7-EFFORT-RANKING.md
```

> **پاسخ کوتاه:** برای رسیدن به **≥۹ و نزدیک ۱۰**، **P10 بیشترین کار** را دارد — نه P8 و نه P9.  
> P8/P9 **پیش‌نیاز** هستند؛ بدون آن‌ها P10 روی شن و ساخته می‌شود.

---

## رتبه‌بندی کار (سخت — بر اساس پروژه واقعی)

| Pack | baseline | هدف exit | **Δ نمره** | **فاصله تا ۱۰** (بعد exit) | **اندازه کار** | **هفته تقریبی** |
| ---- | -------: | -------: | ---------: | -------------------------: | -------------- | --------------: |
| **P8** | 3.2 | ≥9 | **+5.8** | ~1.0–1.5 | متوسط — patch روی کد موجود | **2–4** |
| **P9** | 3.2 | **≥8.7 (fit)** | **+5.5** | ~0.8 | packages + delete | **3–5** |
| **P10** | 3.4 | **≥8.7 (fit)** | **+5.3** | ~0.8–1.0 | infra greenfield | **5–10** |
| **جمع مسیر** | — | platform ~9 | — | ~0.5 | **P8→P9→P10 پشت سر هم** | **10–19** |

### چرا P10 سنگین‌تر است؟

| محور P10 | baseline | برای ۹ چه لازم است | چرا سخت |
| -------- | -------: | ------------------- | -------- |
| **TLS** | **1.5** | Caddy/nginx · loopback · on-demand ask · cert renewal | **از صفر** در repo |
| **Ops** | **3.0** | incident ۴ unit · rollback · DR VPS · alert SSL | مستندات + فرآیند + تست |
| **Custom domain** | **5.0** | admin apex · SSL live · club دوم · SMS | defer در trunk · stub API |
| Deploy | 4.0 | smoke 4/4 · GHA gate | نیمه‌کاره — راحت‌تر از TLS |

P8 worst axis = session **2.5** — ولی همه fixها **داخل monorepo app code** است.  
P10 worst axis = TLS **1.5** — **خارج از app**: DNS، edge، VPS، GHA، runbook.

---

## projection نمره (سخت — بعد از هر pack)

| مرحله | P8 | P9 | P10 | **platform کلی** | **apex HTTPS club۲** |
| ----- | -: | -: | --: | -----------------: | --------------------: |
| الان | 3.2 | 3.2 | 3.4 | **3.2** | **3.4** |
| P8 exit | **8.3–8.7** | 3.2 | 3.8 | **7.5** | 4.5 |
| +P9 exit | 8.5 | **8.7–9.0** | 4.0 | **8.5** | 5.0 |
| +P10 exit | 8.5 | 9.0 | **8.7–9.1** | **8.8–9.0** | **8.7–9.0** |
| **سقف واقع‌بینانه** | ~8.8 | ~9.2 | ~9.2 | **~9.0** | **~9.0** |

App fit: [p10-app-fit.md](p10-app-fit.md) · Alignment: [POST-P7-PACK-ALIGNMENT.md](../POST-P7-PACK-ALIGNMENT.md)

---

## کمبودهای P10 — دسته‌بندی با effort

### XL — بلوکر نزدیک ۱۰ (بیشترین کار)

| ID | Gap | effort | Δ امتیاز تقریبی | وابستگی |
| -- | --- | ------ | --------------- | -------- |
| G-TLS-01 | zero reverse-proxy template | XL | TLS +4 | — |
| G-TLS-02 | Profile C doc-only | XL | TLS +3 | G-TLS-01 |
| G-OPS-01 | no incident runbook 4-process | L | OPS +3 | — |
| G-DOM-01 | admin custom apex | **trunk v2** | — | out of P10 exit |
| G-TLS-03 | on-demand TLS ask | L | TLS +2 | after wildcard staging |
| G-DOM-03 | SMS RESEND | **waiver** | — | phase-18 |

### L — برای عبور از ۹

| ID | Gap | effort |
| -- | --- | ------ |
| G-TLS-04 | apps public 0.0.0.0 — need loopback | L |
| G-TLS-05 | forwarded-proto trust | M (P8 overlap) |
| G-DEP-01 | health-check 2/4 only | M |
| G-DEP-02 | GHA no post-deploy smoke | M |
| G-DOM-02 | SSL provider stub in platform | L |
| G-OPS-02 | DR drill CI-only not VPS | L |
| G-DOM-04 | second club playbook missing | M |

### M — ۹ → 9.5

| ID | Gap |
| -- | --- |
| G-DEP-03..10 | build npm · env · rollback |
| G-TLS-06/07 | cert renewal · secure cookie E2E |
| G-OPS-04/05 | SSL alert · ufw verify |
| G-DOM-05 | custom domain E2E HTTPS |

### جدید — gaps کشف‌شده از پروژه (v1.1)

| ID | Sev | Gap | evidence |
| -- | --- | --- | -------- |
| G-TLS-08 | P1 | `PLATFORM_ROOT_DOMAIN` production unset / undocumented VPS | api env · build-club-site-urls |
| G-TLS-09 | P1 | no HTTP→443 redirect at edge | deploy/vps empty |
| G-TLS-10 | P2 | wildcard `*.staging.example.com` vs on-demand custom — strategy undecided | Profile C matrix |
| G-DEP-11 | P1 | **no staging VPS** separate from prod — Profile C risky on same box | single VPS deploy |
| G-DEP-12 | P2 | `deploy-vps.yml` no concurrency smoke artifact upload | workflow |
| G-OPS-07 | P1 | no VPS uptime/alert (Prometheus k8s only) | deploy/prometheus |
| G-OPS-08 | P2 | secrets rotation runbook (JWT · revalidate) missing | api.env |
| G-DOM-06 | P2 | `custom_domain` billing gate — club۲ needs subscription row | platform tests |
| G-DOM-07 | P2 | MinIO/Redis/Postgres prod — no runbook when object storage full | VPS README |
| G-P10-X01 | P1 | **P8+P9 must exit first** — else P10 score capped at ~7 | dependency chain |

---

## مسیر پیشنهادی P10 (فقط بعد از P8+P9)

```text
Sprint 1 (XL): Caddy wildcard staging TLS + loopback + smoke-four-process
Sprint 2 (L):  GHA post-deploy smoke + rollback-vps.sh + incident runbook
Sprint 3 (M):  M+P custom apex + on-demand ask (Wave C)
Sprint 4 (M):  second club runbook · E2E HTTPS · p10:gate
```

**NOT in sprint path:** admin custom apex (trunk v2)

**قبل از Sprint 1 P10:** P8 Wave A+B (session/env/ingress) + P9 Wave A (packages + حذف web BFF).

---

## سقف نمره — چرا ۱۰ نمی‌شود (حتی بعد exit)

| مانع | cap |
| ---- | --- |
| Profile B IP هنوز برای بعضی clubها | ingress/session −0.3 |
| SMS real provider نشده (waiver) | custom domain −0.3 |
| DR VPS monthly نشده (CI-only) | ops −0.3 |
| Monitoring VPS ≠ k8s stack | ops −0.2 |
| Edge tenant signing enterprise | ingress −0.2 |

**حداکثر سخت post-P10:** **~9.2 platform · ~9.0 apex**

---

## References

- [p10-gap-registry.md](p10-gap-registry.md)
- [p10-action-plan.yaml](p10-action-plan.yaml)
- [../POST-P7-EFFORT-RANKING.md](../POST-P7-EFFORT-RANKING.md)
- [../phase-21/p8-ingress-session-env-audit.md](../phase-21/p8-ingress-session-env-audit.md)
- [../phase-22/p9-code-consolidation-audit.md](../phase-22/p9-code-consolidation-audit.md)
