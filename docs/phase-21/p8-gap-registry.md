# P8 — Gap registry (fit-aligned v1.2)

```yaml
registry_id: P8-GAP-REGISTRY
pack: P8
version: "1.2"
status: PLANNED
audit: p8-ingress-session-env-audit.md
app_fit: p8-app-fit.md
env_contract: p8-env-contract.yaml
```

> **Scope:** Profile A dev + Profile B VPS IP. G-* با EPIC **P9/P10** در P8 انجام **نمی‌شود**.

---

## Ingress (P8 scope)

| ID | Sev | Gap | EPIC | Owner |
| -- | --- | --- | ---- | ----- |
| G-ING-01 | P0 | API tenant-context بدون IP fallback | P8-0 | **P8** |
| G-ING-02 | P0 | Marketing silent smoke fallback in prod | P8-0 | **P8** |
| G-ING-03 | P1 | Portal vs marketing bootstrap mismatch | P8-0 | **P8** |
| G-ING-04a | P1 | Parser surface: `club_portal` vs `club_apex` vs `club_admin` | P8-0 | **P8** |
| G-ING-04b | P2 | Custom domain `tenant_domains.surface` DB enforce | P10-0 | **P10** |
| G-ING-05a | P1 | Doc: API bind loopback · BFF only client | P8-0 | **P8** |
| G-ING-05b | P2 | Edge signed `x-forwarded-host` at TLS edge | P10-1 | **P10** |

## Ingress — moved out of P8

| ID | Was | Owner | Why |
| -- | --- | ----- | --- |
| G-ING-06 | pluginId hostname heuristic | **P9** | dedup bootstrap — not ingress fix |
| G-ING-07 | triplicate resolve-host-tenant | **P9** | shared package |
| G-ING-08 | env alias unread M+P | **P8-2** | env only — keep in P8 |

---

## Session (P8 scope: web operator + portal member)

| ID | Sev | Gap | EPIC | Owner |
| -- | --- | --- | ---- | ----- |
| G-SES-01 | P0 | Same cookie name `session` web+portal | P8-1 | **P8** |
| G-SES-02 | P0 | IP cross-port cookie bleed (fix: **rename**, not __Host-) | P8-1 | **P8** |
| G-SES-03 | P0 | `sessionTenantMatchesHost` fail-open prod | P8-1 | **P8** |
| G-SES-04 | P1 | No portal middleware | P8-1 | **P8** |
| G-SES-05 | P1 | Portal `/me` no JWT vs host check | P8-1 | **P8** |
| G-SES-06 | P1 | Portal ignores SESSION_COOKIE_SECURE | P8-1 | **P8** |
| G-SES-07 | — | ~~`__Host-` prefix~~ | — | **P10** (HTTPS only) |
| G-SES-08 | P3 | SameSite Strict admin | P8-1 | optional P8 |
| G-SES-09 | — | Web public-auth duplicate | — | **P9** |

**Not P8:** marketing session middleware (anonymous catalog SSR).

---

## Env (P8 scope — four-process VPS)

| ID | Sev | Gap | EPIC | Owner |
| -- | --- | --- | ---- | ----- |
| G-ENV-01 | P0 | Bootstrap only api+web | P8-2 | **P8** |
| G-ENV-02 | P1 | verify-coherence web-only | P8-2 | **P8** |
| G-ENV-03 | P1 | Env naming drift | P8-2 | **P8** |
| G-ENV-04 | P1 | Portal JWT optional in example | P8-2 | **P8** |
| G-ENV-05 | P2 | M+P restart conditional | P8-2 | **P8** |
| G-ENV-06 | P2 | No config:check startup | P8-2 | **P8** |
| G-ENV-07 | P2 | README 2-process header | P8-3 | **P8** |
| G-ENV-08 | P3 | package.json build:operator-vps | P10-2 | **P10** |

---

## Exit scores (fit-aligned)

| Axis | Profile A | Profile B IP | Owner completion |
| ---- | --------: | -----------: | ---------------- |
| Ingress | ≥9 | ≥8 | P8 |
| Session | ≥9 | **≥8** (IP cap) | P8 |
| Env | ≥9 | ≥9 | P8 |
| HTTPS / __Host- / custom apex | — | — | P10 |

---

## Wave map (corrected)

| Wave | P8-only IDs |
| ---- | ----------- |
| **A** | G-ING-01/02 · G-SES-01/02/03/06 · G-ENV-01 |
| **B** | G-ING-03/04a/05a · G-SES-04/05 · G-ENV-02..06 |
| **C** | G-ENV-07 · p8:gate |
| **Not P8** | G-ING-06/07 · G-SES-07/09 · G-ING-04b/05b · G-ENV-08 |

---

## References

- [p8-app-fit.md](p8-app-fit.md)
- [p8-ingress-session-env-audit.md](p8-ingress-session-env-audit.md)
