# P6 — E2E smoke runbook (SMK-P6 browser)

```yaml
runbook_id: P6-E2E-SMOKE
nano: P6-4-N-007
authority: appendices/SMOKE-SCENARIO-MAP-P6.md
gate_e2e: scripts/p6-denali-e2e-gate.sh
gate_ci: .github/workflows/p6-denali-gate.yml
gate_product: pnpm run p6:gate
```

> **Scope:** Product closure uses **`pnpm run p6:gate`**. Full browser proof for **VS-01..07** via **`pnpm run p6:e2e-gate`**. CI: `p6-denali-gate.yml`.

---

## When to run

| Context | Command |
| ------- | ------- |
| Daily regression | `pnpm run p6:gate` only |
| Pre-staging | `pnpm run p6:e2e-gate` |
| CI | `p6-denali-gate.yml` — product on PR · E2E weekly · staging manual |

```bash
pnpm run p6:e2e-gate   # p6:gate + VS-01 + portal + marketing smokes
```

---

## Prerequisites

| Item | Value |
| ---- | ----- |
| Smoke club | `operator` |
| Tenant ID | `00000000-0000-4000-8000-000000000014` |
| Dev OTP | `1234` (`AUTH_ALLOW_DEV_STATIC_OTP=true`) |
| `/etc/hosts` | `operator.localhost` · `operator.portal.localhost` · `operator.admin.localhost` · `shop.operator.localhost` · `urban.localhost` (SMK-MKT-05) |

Start stack (example — adjust to your local scripts):

```bash
# API + apps must be running on 3000/3001/3002/3003
# Operator Playwright (`playwright.operator.config.ts`) bootstraps ephemeral JWT keys
# in `smoke-operator-e2e-servers.mjs` (API + web share the same pair).
# Marketing E2E helper (if used):
node apps/marketing/scripts/smoke-marketing-e2e-servers.mjs
```

---

## Scenario matrix

| ID | VS | App | Spec file | npm script | Pass signal |
| -- | -- | --- | --------- | ---------- | ----------- |
| **SMK-P6-HOST-01** | — | API | `scripts/smoke-p6-host-bind.mjs` | `node scripts/smoke-p6-host-bind.mjs` | same `tenantId` ×3 hosts |
| **SMK-P6-VS-01** | VS-01 | web | `p6-admin-publish-smoke.spec.ts` | `playwright.operator.config.ts -g SMK-P6-VS-01` | draft hidden · publish → catalog |
| **SMK-P6-MKT-02** | VS-02 | marketing | `marketing-catalog-smoke.spec.ts` | `@apps/marketing test:smoke` | tour list visible |
| **SMK-P6-MKT-05** | VS-02b | marketing | `marketing-urban-catalog-smoke.spec.ts` | `@apps/marketing test:smoke:urban` | urban skin · city filter |
| **SMK-P6-MKT-03** | VS-03 | marketing→portal | `SMK-MKT-03` in same file | same | CTA lands portal · success marker |
| **SMK-P6-PTL-01** | VS-03 | portal | `portal-registration-smoke.spec.ts` | `@apps/portal test:smoke` | `[data-public-registration-success]` |
| **SMK-P6-PTL-02** | VS-04 | portal | `portal-member-smoke.spec.ts` SMK-PTL-02 | `@apps/portal test:smoke` | `/me/registrations` lists row |
| **SMK-P6-PTL-05** | VS-04 | portal | `portal-member-smoke.spec.ts` SMK-PTL-05 | `@apps/portal test:smoke` | `/` → `/me/registrations` when session |
| **SMK-P6-PTL-03** | VS-04 | portal | `portal-member-registrations.spec.ts` | unit in `p6:gate` | BFF `view=mine` |
| **SMK-P6-PTL-04** | VS-05 | portal | `portal-member-smoke.spec.ts` SMK-PTL-04 | `@apps/portal test:smoke` | receipt upload 201 |
| **SMK-P6-PTL-06** | VS-04 | portal | `portal-member-smoke.spec.ts` SMK-PTL-06 | `@apps/portal test:smoke` | logout · middleware blocks `/me/*` |
| **SMK-P6-PTL-07** | VS-03 | portal | `portal-registration-transport-smoke.spec.ts` DEN-TRANS-01 | `@apps/portal test:smoke` | bus tour `…213` hides transport UI · body omits `transport` |
| **SMK-P6-PTL-08** | VS-03 | portal | `portal-registration-transport-smoke.spec.ts` DEN-TRANS-02 | `@apps/portal test:smoke` | personal-car opt-in → `transport.kind=personal_car` |
| **SMK-P6-PTL-09** | VS-03 | portal | `portal-registration-transport-smoke.spec.ts` DEN-TRANS-03 | `@apps/portal test:smoke` | shared_cars `…214` dong → `transport.kind=no_car_dong` |
| **SMK-P6-ADM-01** | VS-06 | web | `operator-smoke.spec.ts` SMK-P9-04 | `playwright.operator.config.ts -g SMK-P9-04` | booking approved (fa/en status) |
| **SMK-P6-ADM-02** | VS-07 | web | `p6-operator-receipt-approve-smoke.spec.ts` SMK-P6-ADM-02 | `playwright.operator.config.ts -g SMK-P6-ADM-02` | receipt approved · queue empty |

Legacy IDs **SMK-MKT-03** · **SMK-PTL-01** map to SMK-P6 rows above.

---

## Playwright configs (canonical hosts)

| App | Config | `baseURL` |
| --- | ------ | --------- |
| Portal | `apps/portal/playwright.portal.config.ts` | `http://operator.portal.localhost:3003` |
| Marketing | `apps/marketing/playwright.marketing.config.ts` | `http://operator.localhost:3002` |
| Admin | `apps/web/playwright.operator.config.ts` | `http://operator.admin.localhost:3000` |

---

## Commands (copy-paste)

```bash
# 1 — Product gate (always)
pnpm run p6:gate

# 2 — Host bind (API must be up)
node scripts/smoke-p6-host-bind.mjs

# 3 — Portal registration E2E
pnpm --filter @apps/portal run test:smoke:install   # once per machine
pnpm --filter @apps/portal run test:smoke           # SMK-PTL-01 / SMK-P6-PTL-01

# 4 — Marketing catalog + CTA E2E
pnpm --filter @apps/marketing run test:smoke        # SMK-MKT-03

# 4b — Urban marketing regression (optional · not in p6:e2e-gate)
PW_NO_REUSE_SERVER=1 pnpm --filter @apps/marketing run test:smoke:urban   # SMK-MKT-05

# 5 — Operator VS-07 (E2E in p6:e2e-gate — runs before VS-06)
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts -g "SMK-P6-ADM-02"

# 6 — Operator VS-06 (E2E in p6:e2e-gate)
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts -g "SMK-P9-04"

# 7 — Postgres finance depth (staging only)
pnpm run p6:staging-gate   # requires DATABASE_URL
```

---

## Env matrix (E2E)

| Variable | Portal | Marketing | Web admin |
| -------- | ------ | --------- | --------- |
| `AUTH_ALLOW_DEV_STATIC_OTP` | via API | — | `true` |
| `ALLOW_DEV_WEB_SESSION` | — | — | `true` |
| `TOUR_OPS_API_URL` | BFF | BFF | BFF |
| `PORTAL_PUBLIC_BASE_URL` | override CTA | CTA target | redirect shim |

---

## Failure triage

| Symptom | Check |
| ------- | ----- |
| Wrong tenant on portal | `p6-host-tenant-parity.spec.ts` · host in Playwright config |
| CTA goes to legacy `{club}.localhost:3003` | `buildDevPortalPublicBaseUrl` in marketing bridge |
| OTP step timeout | API up · `public-auth` BFF warm · dev OTP `1234` |
| `/me` empty | session cookie · BFF `bookings?view=mine` |
| Finance approve fails | Postgres + `finance-ops.spec.ts` (see FINANCE-OPS-P6-NOTE.md) |
| Admin `/bookings` shows Not Found | Playwright must use `operator.admin.localhost:3000` — middleware blocks admin paths on bare `127.0.0.1` |
| SMK-P9-04 status assertion fails | Operator UI is fa-IR — expect `تأییدشده` not literal `approved` |
| SMK-MKT-05 detail 404 / empty catalog | Stale API on `:3001` without urban seed — use `PW_NO_REUSE_SERVER=1` or kill ports · probe checks list **and** detail endpoints |
| SMK-MKT-03 portal register 503 | Stale portal/API without operator seed or Denali exposure Prisma without DB — use `PW_NO_REUSE_SERVER=1` · probe checks `/denali/catalog/:tourId` |
| Urban marketing skin missing | Run `pnpm run generate:workspace-registry` — `workspace-guest-theme-stylesheets.generated.ts` must import `urban-marketing.css` |

---

## References

- [SMOKE-SCENARIO-MAP-P6.md](../appendices/SMOKE-SCENARIO-MAP-P6.md)
- [first-customer-operator.md](first-customer-operator.md) — VS-06/07
- [guest-slice-operator-minimal.md](guest-slice-operator-minimal.md) — VS-01..03 manual
- [host-subdomain-map.md](host-subdomain-map.md) — Postgres Denali full stack (`denali.localhost:3002` + `denali.portal.localhost:3003`)
