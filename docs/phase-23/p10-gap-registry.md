# P10 — Gap registry (strict audit v1.3 — app-fit aligned)

```yaml
registry_id: P10-GAP-REGISTRY
pack: P10
version: "1.3"
app_fit: p10-app-fit.md
effort: p10-effort-to-nine.md
```

> Severity: P0 = blocker for second club on custom apex HTTPS.

---

## TLS · reverse-proxy · DNS (G-TLS)

| ID | Sev | Gap | EPIC | Evidence |
| -- | --- | --- | ---- | -------- |
| G-TLS-01 | P0 | No reverse-proxy/TLS template in repo | P10-1 | `deploy/vps/` grep empty |
| G-TLS-02 | P0 | Profile C doc-only — no HTTPS deploy path | P10-1 | P7-PORT-MATRIX §C |
| G-TLS-03 | **P2** | SSL on-demand ask — **after** wildcard staging TLS | P10-0 | not Wave A blocker |
| G-TLS-04 | P1 | Apps exposed 0.0.0.0:3000–3003 publicly | P10-1 | systemd · ufw doc |
| G-TLS-05 | P1 | Forwarded-Proto/Host trust undocumented | P10-1 | P8 G-ING-05 overlap |
| G-TLS-06 | P2 | Cert renewal runbook missing | P10-3 | — |
| G-TLS-07 | P2 | SESSION_COOKIE_SECURE HTTPS unproven E2E | P10-1 | Profile B false |

---

## Deploy · CI/CD (G-DEP)

| ID | Sev | Gap | EPIC | Evidence |
| -- | --- | --- | ---- | -------- |
| G-DEP-01 | P0 | health-check.sh api+web only — not M+P HTTP | P10-2 | health-check.sh |
| G-DEP-02 | P0 | deploy-vps.yml no GHA post-deploy smoke | P10-2 | deploy-vps.yml |
| G-DEP-03 | P1 | package.json build:operator-vps ≠ build script | P10-2 | package.json:110 |
| G-DEP-04 | P1 | bootstrap api+web only — **implement P8**; P10 = regression | P8 primary | P8 G-ENV-01 |
| G-DEP-05 | P1 | verify web-only — **implement P8**; P10 = regression | P8 primary | P8 G-ENV-02 |
| G-DEP-06 | P1 | p7-staging-verify M+P WARN not fail | P10-2 | p7-staging-verify.sh |
| G-DEP-07 | P2 | M+P restart conditional on env file | P10-2 | remote-deploy.sh |
| G-DEP-08 | P2 | README header 2-process drift | P10-3 | deploy/vps/README L1–10 |
| G-DEP-09 | P2 | smoke-operator-login web-only | P10-2 | smoke script |
| G-DEP-10 | P3 | No idempotent rollback script | P10-3 | — |

---

## Observability · ops (G-OPS)

| ID | Sev | Gap | EPIC | Evidence |
| -- | --- | --- | ---- | -------- |
| G-OPS-01 | P0 | No four-process VPS incident runbook | P10-3 | — |
| G-OPS-02 | P1 | restore-drill CI only — not VPS four-app | P10-3 | restore-drill-monthly.yml |
| G-OPS-03 | **—** | deploy/prometheus k8s — not VPS | **waive** | single VPS model |
| G-OPS-04 | P2 | SSL expiry UI — no VPS alert wiring | P10-3 | platform-domains-ssl |
| G-OPS-05 | P2 | UFW manual — no verify script | P10-3 | README |
| G-OPS-06 | P3 | No deploy version header for smoke | P10-3 | — |

---

## Custom domain (G-DOM)

| ID | Sev | Gap | EPIC | Evidence |
| -- | --- | --- | ---- | -------- |
| G-DOM-01 | **P2** | Admin **custom** apex deferred (trunk v1 M+P only) | **P10+ / trunk v2** | p6 H-P6-03 — exit uses `{club}.admin.{root}` subdomain |
| G-DOM-02 | P1 | SSL provider stub — no live ACME edge | P10-0 | platform-domains-ssl |
| G-DOM-03 | **—** | Profile C SMS OTP stub | **waiver / phase-18** | not P10 infra exit gate |
| G-DOM-04 | P2 | Second club onboarding runbook missing | P10-0 | — |
| G-DOM-05 | P2 | No E2E verified custom domain HTTPS | P10-2 | specs partial |

---

## Extended gaps v1.2 (project-derived — بیشترین کار P10)

| ID | Sev | Effort | Gap | EPIC |
| -- | --- | ------ | --- | ---- |
| G-TLS-08 | P1 | M | `PLATFORM_ROOT_DOMAIN` production path undocumented on VPS | P10-0 |
| G-TLS-09 | P1 | M | No HTTP→443 redirect at edge | P10-1 |
| G-TLS-10 | P2 | M | Wildcard platform subdomain vs on-demand custom — strategy open | P10-1 |
| G-DEP-11 | P2 | No separate staging VPS | optional | single box OK with care |
| G-DEP-12 | P2 | S | deploy-vps.yml no smoke artifact upload on fail | P10-2 |
| G-OPS-07 | P1 | L | No VPS uptime/alert (Prometheus is k8s-only) | P10-3 |
| G-OPS-08 | P2 | M | Secrets rotation runbook (JWT · revalidate) missing | P10-3 |
| G-DOM-06 | P2 | M | `custom_domain` subscription row required for club 2 | P10-0 |
| G-DOM-07 | P2 | M | MinIO/disk full — no ops runbook | P10-3 |
| G-P10-X01 | P1 | — | P8+P9 exit required — else P10 capped ~7 | prerequisite |

**Effort legend:** S ≤1d · M 1–3d · L 3–7d · XL 1–3w

---

## Score summary (strict)

| Axis | Current | P10 target (fit) |
| ---- | ------: | ---------------: |
| TLS / reverse-proxy | 1.5 | **≥ 8.5** |
| Deploy / CI | 4.0 | **≥ 9** |
| Ops / observability | 3.0 | **≥ 8.5** |
| Env coherence | 3.5 | **≥ 9** |
| Custom domain (M+P) | 5.0 | **≥ 8** |
| **Composite** | **3.4** | **≥ 8.7** |
| Profile B (IP HTTP) | ~6.5 | no regression |
| **Effort to exit** | — | — | **5–10 weeks post P8+P9** |

Detail: [p10-effort-to-nine.md](p10-effort-to-nine.md)

---

## Wave map

| Wave | IDs |
| ---- | --- |
| **A (P0)** | G-TLS-01/02/04 · G-DEP-01/02 · G-OPS-01 |
| **B (P1)** | G-TLS-05/06/07 · G-DEP-03..10 · G-OPS-02/04/05 · G-DOM-02 |
| **C (P2+)** | G-TLS-03/10 · G-DOM-01/04/05/06/07 · G-OPS-06/08 · G-DEP-08/12 |

---

## References

- [p10-app-fit.md](p10-app-fit.md)
- [p10-production-grade-audit.md](p10-production-grade-audit.md)
- [p10-action-plan.yaml](p10-action-plan.yaml)
- [p10-effort-to-nine.md](p10-effort-to-nine.md)
- [../POST-P7-EFFORT-RANKING.md](../POST-P7-EFFORT-RANKING.md)
