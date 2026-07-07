# P10 — Audit سخت‌گیرانه: production grade

```yaml
audit_id: P10-PRODUCTION-GRADE-AUDIT
version: "1.1"
date: 2026-06-22
app_fit: p10-app-fit.md
method: code-first · deploy/CI inspection · enterprise SaaS edge patterns
```

> **App fit (v1.1):** [p10-app-fit.md](p10-app-fit.md) — **~80% fits**; corrections: wildcard TLS first · admin custom apex defer · Profile B kept · exit **≥8.7**.

> **روش:** نمره بر اساس **آمادگی club دوم روی custom apex + HTTPS** — نه «VPS IP کار می‌کند».  
> الهام: [Caddy on-demand TLS](https://caddyserver.com/docs/automatic-https) · [multi-tenant SaaS edge (Caddy + loopback apps)](https://tallcms.com/docs/multi-tenant-saas-on-digitalocean-with-caddy-cloudflare-nginx-and-ploi) · [post-deploy smoke gates (GHA)](https://how2.sh/posts/how-to-gate-production-deployments-with-synthetic-smoke-tests/) · [platform-domains-ssl.mdoc](../phase-15/platform-domains-ssl.mdoc).

---

## نمره کلی (سفت)

| محور | نمره | معنی |
| ---- | ---: | ---- |
| **TLS / reverse-proxy / DNS (Profile C)** | **1.5 / 10** | صفر template در repo · Profile C فقط doc |
| **Deploy pipeline & CI/CD** | **4.0 / 10** | remote-deploy چهارپروسه partial · health/smoke ناقص |
| **Observability & ops runbooks** | **3.0 / 10** | k8s prometheus هست · VPS incident/rollback نه |
| **Env coherence (production)** | **3.5 / 10** | همان شکاف P8 · `build:operator-vps` npm ≠ script |
| **Custom domain production path** | **5.0 / 10** | API + DB model هست · edge + admin apex ناقص |
| **میانگین** | **3.4 / 10** | **ناکافی** برای مشتری دوم apex |
| **Profile B (IP HTTP) today** | **~6.5 / 10** | P7 delivery path قابل تحویل با waiver |
| **هدف P10 exit (fit)** | **≥ 8.7 / 10** | Profile C staging HTTPS · smoke 4/4 |

---

## 1. TLS · reverse-proxy · DNS (Profile C)

### آنچه درست است (+)

| # | مورد | شواهد |
| - | ---- | ----- |
| T+1 | Profile C URL matrix documented | `P7-PORT-MATRIX.md` § Profile C |
| T+2 | Host grammar + custom domain model | `p6-host-addressing-architecture.mdoc` |
| T+3 | `tenant_domains` SSL columns + verify API | `platform-domains-ssl.mdoc` |
| T+4 | systemd four units + ports 3000–3003 | `deploy/vps/systemd/` |

### شکاف‌های بحرانی (−)

| ID | Sev | شکاف | شواهد | استاندارد enterprise |
| -- | --- | ---- | ----- | --------------------- |
| G-TLS-01 | **P0** | **هیچ** nginx/caddy/certbot template در `deploy/vps/` | `grep deploy/` empty | Edge owns 80/443 · apps loopback |
| G-TLS-02 | **P0** | Profile C **doc-only** — هیچ مسیر deploy/test HTTPS | P7-PORT-MATRIX C | Staging subdomain TLS proven |
| G-TLS-03 | **P1** | SSL provision **stub** — edge واقعی وصل نیست | platform-domains-ssl | Caddy on-demand `ask` → tenant_domains |
| G-TLS-04 | **P1** | Apps روی `0.0.0.0:3000–3003` مستقیم exposed | systemd · ufw doc | reverse_proxy → 127.0.0.1 only |
| G-TLS-05 | **P1** | `x-forwarded-host` / `X-Forwarded-Proto` trust undocumented for HTTPS | P8 G-ING-05 | Edge sets verified headers |
| G-TLS-06 | **P2** | Cert renewal runbook missing | — | Caddy auto-renew + expiry alert |
| G-TLS-07 | **P2** | `SESSION_COOKIE_SECURE=true` + HTTPS end-to-end **unproven** | Profile B uses false | OWASP secure cookies on prod |

### نمره جزئی TLS

| زیرمعیار | نمره |
| -------- | ---: |
| Edge templates in repo | 0 |
| Profile C deploy path | 1 |
| On-demand TLS integration | 2 |
| Loopback-only apps | 3 |
| Cookie secure on HTTPS | 4 |

---

## 2. Deploy pipeline & CI/CD

### آنچه درست است (+)

| # | مورد | شواهد |
| - | ---- | ----- |
| D+1 | `deploy-vps.yml` on push main + SSH | `.github/workflows/deploy-vps.yml` |
| D+2 | `remote-deploy.sh` — migrate · 4-port listen wait · smoke | lines 76–115 |
| D+3 | `build-operator-vps.sh` builds **all four** Next apps | lines 80–81 |
| D+4 | `p7-staging-gate.yml` workflow_dispatch remote | GHA |
| D+5 | M+P `/health` endpoints exist | marketing/portal playwright configs |

### شکاف‌های بحرانی (−)

| ID | Sev | شکاف | شواهد | استاندارد enterprise |
| -- | --- | ---- | ----- | --------------------- |
| G-DEP-01 | **P0** | `health-check.sh` فقط **api + web** HTTP — نه marketing/portal | lines 19–64 | Four-process health gate |
| G-DEP-02 | **P0** | `deploy-vps.yml` **بدون** post-deploy smoke job در GHA runner | workflow 49–60 only SSH | Synthetic smoke after deploy |
| G-DEP-03 | **P1** | `package.json build:operator-vps` فقط api+web — **≠** `build-operator-vps.sh` | root package.json:110 | Single build entry |
| G-DEP-04 | **P1** | `bootstrap-server.sh` api+web env only | P8 G-ENV-01 | Four env bootstrap |
| G-DEP-05 | **P1** | `verify-env-coherence.sh` web↔api only | script | `--all` four env |
| G-DEP-06 | **P1** | `p7-staging-verify` M+P health **WARN** not fail | lines 34–45 | Fail-closed staging |
| G-DEP-07 | **P2** | M+P restart **conditional** on env file exists | remote-deploy 79–84 | Always four units |
| G-DEP-08 | **P2** | README header هنوز **2-URL** operator-only | deploy/vps/README L1–10 | Four-process first |
| G-DEP-09 | **P2** | `smoke-operator-login.sh` web OTP only — no portal/marketing smoke post-deploy | script | Critical path per surface |
| G-DEP-10 | **P3** | No rollback script in deploy chain | — | Idempotent rollback on smoke fail |

### نمره جزئی deploy

| زیرمعیار | نمره |
| -------- | ---: |
| Remote deploy automation | 7 |
| Four-process build | 7 |
| Four-process health HTTP | 2 |
| GHA smoke gate | 3 |
| Env coherence CI | 4 |
| Rollback | 1 |

---

## 3. Observability & ops

### آنچه درست است (+)

| # | مورد | شواهد |
| - | ---- | ----- |
| O+1 | API `/health` with DB check | smoke-operator-login |
| O+2 | `restore-drill-monthly.yml` GHA | DEC-125 |
| O+3 | `journalctl` / systemd docs | deploy README |
| O+4 | `show-infra-profile.sh` prod vs dev | script |

### شکاف‌های بحرانی (−)

| ID | Sev | شکاف | شواهد | استاندارد enterprise |
| -- | --- | ---- | ----- | --------------------- |
| G-OPS-01 | **P0** | **No** four-process VPS incident runbook | — | cert expiry · unit down · rollback |
| G-OPS-02 | **P1** | `restore-drill-smoke.sh` CI Postgres only — **not** VPS four-app | workflow | Monthly VPS DR drill |
| G-OPS-03 | **P1** | `deploy/prometheus/` targets **k8s** — not VPS systemd | deploy/ | VPS metrics or waive |
| G-OPS-04 | **P2** | SSL expiry KPI in platform UI — **no** ops alert wiring to VPS edge | platform-domains-ssl | 30-day cert alert |
| G-OPS-05 | **P2** | UFW ports manual doc — no IaC/check script | README | `ufw status` in verify |
| G-OPS-06 | **P3** | No centralized deploy version header for smoke | — | `X-Deploy-Version` check |

### نمره جزئی ops

| زیرمعیار | نمره |
| -------- | ---: |
| Health endpoints | 6 |
| Incident runbooks | 1 |
| DR drill (VPS) | 2 |
| Monitoring (VPS) | 2 |
| Infra profile clarity | 6 |

---

## 4. Custom domain · tenant_domains production

### آنچه درست است (+)

| # | مورد | شواهد |
| - | ---- | ----- |
| C+1 | `resolveTenantFromCustomDomainHost` | `resolve-tenant-from-custom-domain.ts` |
| C+2 | Platform Domains tab + verify endpoint | `platform-domains-ssl.mdoc` |
| C+3 | `custom_domain` subscription feature gate | platform tests |
| C+4 | Public ingress: platform host → custom domain fallback | architecture mdoc |

### شکاف‌های بحرانی (−)

| ID | Sev | شکاف | شواهد | استاندارد enterprise |
| -- | --- | ---- | ----- | --------------------- |
| G-DOM-01 | **P0** | **Admin custom apex** deferred — trunk v1 marketing+portal only | p6-host §3 · platform-domains §Surfaces | admin.{apex} HTTPS |
| G-DOM-02 | **P1** | SSL provider **stub** — no Cloudflare/live ACME in deploy | platform-domains-ssl | Edge cert matches DB ssl_status |
| G-DOM-03 | **P1** | Profile C SMS OTP — `RESEND` stub | p7-sms-otp-staging.md | Real provider or signed waiver |
| G-DOM-04 | **P2** | Second club onboarding runbook missing | — | tenant_domains + DNS checklist |
| G-DOM-05 | **P2** | No E2E on verified custom domain host | specs partial | SMK custom domain HTTPS |

### نمره جزئی domain

| زیرمعیار | نمره |
| -------- | ---: |
| Data model + API | 7 |
| Admin custom ingress | 3 |
| Edge SSL sync | 4 |
| Second customer playbook | 2 |
| E2E HTTPS custom host | 3 |

---

## اقدامات (موج A/B/C)

### موج A — P0 (Profile C foundation)

| # | اقدام | Gap | فایل هدف |
| - | ----- | --- | -------- |
| A1 | `deploy/vps/caddy/` template — loopback reverse_proxy 3000–3003 · on_demand ask | G-TLS-01/02/04 | new |
| A2 | Wire Caddy `ask` to API tenant_domains verify endpoint | G-TLS-03 | api route |
| A3 | Extend `health-check.sh` + post-deploy smoke — all 4 HTTP `/health` | G-DEP-01/09 | scripts |
| A4 | GHA job post-`deploy-vps`: remote `p10:smoke` or SSH smoke four URLs | G-DEP-02 | workflow |
| A5 | Four-process incident runbook draft | G-OPS-01 | docs/phase-23/runbooks/ |

### موج B — P1

| # | اقدام | Gap |
| - | ----- | --- |
| B1 | Align `package.json build:operator-vps` → `build-operator-vps.sh` | G-DEP-03 |
| B2 | bootstrap + verify `--all` (P8 carryover) | G-DEP-04/05 |
| B3 | `p7-staging-verify` M+P fail-closed | G-DEP-06 |
| B4 | Admin custom apex ingress | **→ trunk v2** (H-P6-03) — exit uses `{club}.admin.{root}` |
| B5 | HTTPS cookie + forwarded-proto doc + smoke | G-TLS-05/07 |
| B6 | Cert renewal + SSL expiry ops runbook | G-TLS-06 · G-OPS-04 |
| B7 | Idempotent `rollback-vps.sh` on smoke fail | G-DEP-10 |

### موج C — P2+

| # | اقدام | Gap |
| - | ----- | --- |
| C1 | Second club onboarding runbook | G-DOM-04 |
| C2 | Custom domain HTTPS E2E | G-DOM-05 |
| C3 | VPS DR drill (four units + Postgres) | G-OPS-02 |
| C4 | README + deploy header four-process | G-DEP-08 |
| C5 | `p10:gate` + pack integrity spec | P10-3 |
| C6 | SMS provider Profile C (or permanent waiver doc) | G-DOM-03 |

---

## معیار exit P10 (سخت)

| # | Gate | ابزار |
| - | ---- | ----- |
| 1 | Profile C staging HTTPS — 3 surfaces on **platform subdomain** | manual + smoke |
| 2 | Post-deploy smoke 4 surfaces | CI |
| 3 | Caddy template tested (wildcard first) | deploy/vps |
| 4 | M+P custom apex path documented (phase 2) | runbook |
| 5 | Second club runbook + staging proof | evidence |
| 6 | Incident runbook sign-off | p10-exit-checklist |
| 7 | Profile B IP no regression | P7 smoke |
| 8 | Re-score audit ≥ **8.7/10** | this doc |

---

## P8/P9 overlap (must be closed first)

| Item | Owner |
| ---- | ----- |
| Env bootstrap/verify 4 files | **P8** — P10 regression gate only |
| Edge trust doc (lite) | **P8** G-ING-05a |
| HTTPS forwarded-proto proof | **P10** G-ING-05b |
| `tenant_domains.surface` DB enforce | **P10** G-ING-04b |
| Web guest BFF removal | **P9** |

---

## References (external)

- [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [Caddy On-Demand TLS](https://caddyserver.com/on-demand-tls)
- [Multi-tenant SaaS edge (Caddy)](https://tallcms.com/docs/multi-tenant-saas-on-digitalocean-with-caddy-cloudflare-nginx-and-ploi)
- [Gate deployments with smoke tests](https://how2.sh/posts/how-to-gate-production-deployments-with-synthetic-smoke-tests/)

---

## Internal

- [p10-app-fit.md](p10-app-fit.md)
- [p10-effort-to-nine.md](p10-effort-to-nine.md) — **🥇 بیشترین کار · projection ۹–۱۰**
- [p10-gap-registry.md](p10-gap-registry.md)
- [p10-action-plan.yaml](p10-action-plan.yaml)
- [p10-production-profile.yaml](p10-production-profile.yaml)
- [platform-production-grade.mdoc](platform-production-grade.mdoc)
- [p10-exit-checklist.md](p10-exit-checklist.md)
- [../phase-20/p7/appendices/P7-PORT-MATRIX.md](../phase-20/p7/appendices/P7-PORT-MATRIX.md)
- [../phase-21/p8-ingress-session-env-audit.md](../phase-21/p8-ingress-session-env-audit.md)
