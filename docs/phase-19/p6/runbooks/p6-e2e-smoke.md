# P6 — E2E smoke runbook (SMK-P6 browser)

```yaml
runbook_id: P6-E2E-SMOKE
nano: P6-4-N-007
authority: appendices/SMOKE-SCENARIO-MAP-P6.md
gate_stub: scripts/p6-denali-e2e-gate.sh
gate_product: pnpm run p6:gate
architect_approval: required for CI wiring
```

> **Scope:** Product closure uses **`pnpm run p6:gate`** (unit/static only). This runbook is the **full browser proof** for VS-01..05 when servers are running.

---

## When to run

| Context | Command |
| ------- | ------- |
| Daily regression | `pnpm run p6:gate` only |
| Pre-staging / Architect YES | This runbook + manual VS-06/07 |
| CI E2E (future) | Wire `p6:e2e-gate` after servers bootstrap |

```bash
pnpm run p6:e2e-gate   # prints stub + manual commands
```

---

## Prerequisites

| Item | Value |
| ---- | ----- |
| Smoke club | `operator` |
| Tenant ID | `00000000-0000-4000-8000-000000000014` |
| Dev OTP | `1234` (`AUTH_ALLOW_DEV_STATIC_OTP=true`) |
| `/etc/hosts` | `operator.localhost` · `operator.portal.localhost` · `operator.admin.localhost` · `shop.operator.localhost` |

Start stack (example — adjust to your local scripts):

```bash
# API + apps must be running on 3000/3001/3002/3003
# Marketing E2E helper (if used):
node apps/marketing/scripts/smoke-marketing-e2e-servers.mjs
```

---

## Scenario matrix

| ID | VS | App | Spec file | npm script | Pass signal |
| -- | -- | --- | --------- | ---------- | ----------- |
| **SMK-P6-HOST-01** | — | API | `scripts/smoke-p6-host-bind.mjs` | `node scripts/smoke-p6-host-bind.mjs` | same `tenantId` ×3 hosts |
| **SMK-P6-MKT-02** | VS-02 | marketing | `marketing-catalog-smoke.spec.ts` | `@apps/marketing test:smoke` | tour list visible |
| **SMK-P6-MKT-03** | VS-03 | marketing→portal | `SMK-MKT-03` in same file | same | CTA lands portal · success marker |
| **SMK-P6-PTL-01** | VS-03 | portal | `portal-registration-smoke.spec.ts` | `@apps/portal test:smoke` | `[data-public-registration-success]` |
| **SMK-P6-PTL-02** | VS-04 | portal | manual | — | `/` → `/me/registrations` with session |
| **SMK-P6-PTL-03** | VS-04 | portal | `portal-member-registrations.spec.ts` | unit in `p6:gate` | BFF `view=mine` |
| **SMK-P6-PTL-04** | VS-05 | portal | manual | — | receipt upload on `/me/registrations/[id]` |
| **SMK-P6-ADM-01** | VS-06 | web | `first-customer-operator.md` | manual | booking approved |
| **SMK-P6-ADM-02** | VS-07 | web | same | manual | receipt approved |

Legacy IDs **SMK-MKT-03** · **SMK-PTL-01** map to SMK-P6 rows above.

---

## Playwright configs (canonical hosts)

| App | Config | `baseURL` |
| --- | ------ | --------- |
| Portal | `apps/portal/playwright.portal.config.ts` | `http://operator.portal.localhost:3003` |
| Marketing | `apps/marketing/playwright.marketing.config.ts` | `http://operator.localhost:3002` |
| Admin | `apps/web/playwright.operator.config.ts` | `http://operator.admin.localhost:3000` (or 127.0.0.1) |

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

# 5 — Operator VS-06/07 (manual)
# → runbooks/first-customer-operator.md
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

---

## References

- [SMOKE-SCENARIO-MAP-P6.md](../appendices/SMOKE-SCENARIO-MAP-P6.md)
- [first-customer-operator.md](first-customer-operator.md) — VS-06/07
- [guest-slice-operator-minimal.md](guest-slice-operator-minimal.md) — VS-01..03 manual
