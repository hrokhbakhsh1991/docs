# P10 — App fit: آیا به معماری ما می‌خورد؟

```yaml
doc_id: P10-APP-FIT
version: "1.0"
date: 2026-06-22
authority: p6-host-addressing-architecture.mdoc · p8-app-fit.md · p9-app-fit.md · P7-PORT-MATRIX
pack: P10
verdict: MOSTLY_FITS_with_scope_corrections
prerequisite: P8 exit · P9 exit
```

> **خلاصه:** بله — **P10 به اپ می‌خورد** چون Profile C (HTTPS + host-based multi-club) همان چیزی است که p6 از اول تعریف کرده و Profile B (IP P7) **جایگزین نمی‌شود**.  
> doc قبلی چند over-scope داشت: admin custom apex P0 · on-demand TLS روز اول · SMS در infra · exit 9.5 همه محور · club دوم production اجباری.

---

## معماری واقعی → نقش P10

| واقعیت | معنی برای P10 |
| -------- | ------------- |
| **یک VPS · یک deploy** | Caddy/nginx روی **همان** box؛ apps loopback |
| **۴ پروسه** (3000–3003) | edge route by Host → 127.0.0.1 |
| **multi-club = host + tenantId** | wildcard platform subdomain **قبل از** custom apex per club |
| **Profile B (P7)** | IP HTTP — **نگه دار** برای مشتری اول |
| **Profile C** | `{club}.admin|portal|apex` + TLS — هدف P10 |
| **trunk v1 custom ingress** | **فقط marketing + portal** — admin custom apex **defer** (H-P6-03) |
| **API** | BFF → loopback `:3001` — **نیازی به expose عمومی api.* نیست** |

مرجع: [p6-host-addressing-architecture.mdoc](../phase-19/p6-host-addressing-architecture.mdoc) §3–6 · [P7-PORT-MATRIX Profile C](../phase-20/p7/appendices/P7-PORT-MATRIX.md)

---

## ✅ داخل P10 — مستقیماً fit

| کار | چرا |
| --- | --- |
| **Caddy/nginx template** `deploy/vps/` | edge 80/443 روی VPS واحد |
| **HTTPS Profile C staging** (`operator.admin.staging.*` و غیره) | P7-PORT-MATRIX §C |
| **smoke چهارپروسه** + GHA post-deploy | remote-deploy الان 2/4 health |
| **bootstrap/verify 4 env** (carryover P8) | همان مدل deploy |
| **loopback bind** apps پشت edge (Profile C) | امنیت production |
| **`SESSION_COOKIE_SECURE=true`** + forwarded-proto | session ~9+ بعد از hostname جدا |
| **incident runbook 4 systemd unit** | ops واقعی VPS |
| **rollback-vps.sh** | smoke fail → برگشت |
| **M+P custom apex** (`denali.club` · `portal.denali.club`) | tenant_domains + ingress chain موجود |
| **runbook club دوم** (platform subdomain) | `alborz.staging.*` بدون IP hack |
| **README Profile C** | deploy/vps هنوز header 2-process |

---

## ❌ خارج از P10 — over-scope یا defer

| مورد | اصلاح | چرا |
| ---- | ----- | --- |
| **G-DOM-01 admin custom apex P0** | **→ P10+ / trunk v2** | p6 §6 H-P6-03: trunk v1 فقط M+P custom |
| **on-demand TLS Wave A P0** | **Wave B/C** — اول **wildcard** platform | club اول روی `*.staging.example.com` کافی |
| **exit: club دوم production live** | **runbook + staging proof** | exit = قابلیت onboard، نه مشتری واقعی دوم |
| **SMS RESEND (G-DOM-03) در P10 exit** | **waiver دائم** یا phase-18 | product · نه infra |
| **API عمومی `https://api.*`** | **اختیاری** — smoke loopback | BFF→API همان VPS |
| **k8s Prometheus (G-OPS-03)** | **waive صریح VPS** | deploy/prometheus برای k8s است |
| **VPS uptime enterprise (G-OPS-07)** | **waive یا P2** | scale فعلی |
| **staging VPS جدا (G-DEP-11)** | **P2 optional** | یک box قابل قبول با care |
| **edge enterprise signing x-forwarded-host** | **loopback trust کافی** | API از اینترنت reachable نیست |
| **deprecate Profile B IP** | **هرگز در P10** | P7 delivery path |
| **exit 9.5 همه محور** | **composite ≥ 8.7** | سقف strict ~9.0–9.2 |

---

## Profile C — exit واقع‌بینانه (fit-aligned)

### فاز ۱ (P10 Wave A — blocker)

```text
Edge Caddy :443
  Host operator.staging.example.com        → 127.0.0.1:3002  (marketing)
  Host operator.portal.staging.example.com → 127.0.0.1:3003  (portal)
  Host operator.admin.staging.example.com  → 127.0.0.1:3000  (web operator)
  API                                      → 127.0.0.1:3001  (internal · BFF only)

TLS: wildcard *.staging.example.com (+ *.portal.staging.example.com)
```

### فاز ۲ (P10 Wave B/C)

- M+P custom apex verified (`tenant_domains`)
- on-demand TLS ask (فقط hostnameهای verified)
- E2E HTTPS روی apex واقعی

### admin HTTPS در exit

| مدل | P10 exit؟ |
| --- | --------- |
| `{club}.admin.{platform_root}` subdomain | **✅ بله** |
| `admin.{customer_apex}` custom domain | **❌ defer** (H-P6-03) |

---

## ترتیب P10 (fit-aligned)

### موج A

1. Caddy template + wildcard TLS staging subdomain
2. smoke-four-process + health-check 4/4
3. GHA post-deploy smoke
4. incident runbook

### موج B

1. loopback bind (Profile C mode)
2. env bootstrap/verify 4-file (P8 carryover)
3. HTTPS cookie smoke
4. cert renewal runbook
5. rollback script

### موج C

1. M+P custom apex + on-demand ask (optional path)
2. second club runbook (platform subdomain)
3. custom domain E2E
4. `p10:gate`

**NOT P10:** admin custom apex · SMS provider · k8s monitoring · per-club deploy

---

## Exit اصلاح‌شده

| محور | هدف realistic |
| ---- | ------------- |
| TLS / edge (Profile C staging) | **≥ 8.5** |
| Deploy / CI smoke 4/4 | **≥ 9** |
| Ops runbooks | **≥ 8.5** |
| Env coherence | **≥ 9** (با P8) |
| Custom domain (M+P) | **≥ 8** |
| **Composite** | **≥ 8.7** |
| Profile B IP | **بدون regression** (~6.5+) |

**سقف strict:** ~9.0–9.2 — نه 10 (SMS stub · DR lite · IP staging optional).

---

## وابستگی P8/P9

| P8/P9 first | Why |
| ----------- | --- |
| P8 env 4-file | Profile C contract |
| P8 cookie rename + secure path design | HTTPS sessions |
| P8 forwarded-proto doc (lite) | edge headers |
| P9 web guest removed | admin-only web on apex |

---

## References

- [../POST-P7-PACK-ALIGNMENT.md](../POST-P7-PACK-ALIGNMENT.md)
- [p8-app-fit.md](../phase-21/p8-app-fit.md)
- [p9-app-fit.md](../phase-22/p9-app-fit.md)
- [p10-gap-registry.md](p10-gap-registry.md)
- [p10-production-profile.yaml](p10-production-profile.yaml)
