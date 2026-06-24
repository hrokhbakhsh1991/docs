# P7 — Staging E2E runbook (T2)

```yaml
runbook_id: P7-STAGING-E2E
nano: P7-3-N-001
tier: T2
authority: p7-3-delivery-exit.md · SMOKE-SCENARIO-MAP-P7.md
prerequisite: [P7-0-N-004, P7-0-N-005]
carryover: ../../phase-19/p6/runbooks/p6-e2e-smoke.md
```

> **Scope:** Re-run P6 browser smokes against **staging URLs** (Profile B or C). Product regression remains `pnpm run p7:gate` (T1).

---

## When to run

| Context | Command |
| ------- | ------- |
| Every PR | `pnpm run p7:gate` only (T1) |
| After four-process staging up | This runbook (T2) |
| Pre sign-off | T2 + T3 + T4 |

**Order:** T1 (`p7:gate`) → T2 (this doc) → T3 (`finance-ops.spec.ts`) → T4 (sign-off).

---

## Prerequisites

| Check | Evidence |
| ----- | -------- |
| Four processes running | API + web + marketing + portal — [p7-0-live-infra.md](../p7-0-live-infra.md) N-004 |
| Env matrix | [p7-0-env-matrix.md](p7-0-env-matrix.md) profile chosen |
| Seed | Smoke or customer fixture — [P7-CUSTOMER-SEED-DELTA.md](../appendices/P7-CUSTOMER-SEED-DELTA.md) |
| Catalog revalidate | `MARKETING_REVALIDATE_URL` + `MARKETING_REVALIDATE_SECRET` on API **and** marketing |
| Playwright browsers | `pnpm --filter @apps/portal run test:smoke:install` (once per machine) |

---

## External servers mode (staging)

Playwright configs boot local servers by default. On staging, **servers already run** — set:

```bash
export PW_EXTERNAL_SERVERS=1
export PW_NO_REUSE_SERVER=1
```

---

## Profile B — VPS IP (copy-paste)

Replace `VPS_IP` (example `89.45.89.206`). API must accept host bind for fallback tenant.

### Profile B-staging — isolated stack (230xx ports)

One-shot probe (seeds VPS · SSH tunnels · host bind · portal/marketing/admin Playwright):

```bash
pnpm run p7:staging-e2e-probe
```

**Runner network:** bare `http://VPS_IP:230xx` may intercept `/_next/static/*` (302/captive portal). The probe opens `ssh -L 127.0.0.1:230xx:…` and sets `VPS_IP=127.0.0.1` so Playwright resolves `operator.*.localhost` through the tunnel.

Manual equivalent (keep tunnel open in another terminal):

```bash
ssh -N -L 127.0.0.1:23000:127.0.0.1:23000 \
       -L 127.0.0.1:23001:127.0.0.1:23001 \
       -L 127.0.0.1:23002:127.0.0.1:23002 \
       -L 127.0.0.1:23003:127.0.0.1:23003 root@89.45.89.206
export VPS_IP=127.0.0.1
export TOUR_OPS_API_URL=http://127.0.0.1:23001
export PW_EXTERNAL_SERVERS=1
export PW_NO_REUSE_SERVER=1
export OPERATOR_OWNER_MOBILE=+15550001001
export OPERATOR_DEV_OTP=1234
export PLAYWRIGHT_BASE_URL=http://operator.admin.localhost:23000
export SMOKE_MARKETING_BASE_URL=http://operator.localhost:23002
export SMOKE_PORTAL_BASE_URL=http://operator.portal.localhost:23003
```

### Profile B — prod-reference ports (3000–3003)

```bash
export VPS_IP=89.45.89.206
export TOUR_OPS_API_URL=http://${VPS_IP}:3001
export PW_EXTERNAL_SERVERS=1
export PW_NO_REUSE_SERVER=1

# OTP — Profile B may keep static OTP until SMS wired
export AUTH_ALLOW_DEV_STATIC_OTP=true   # api.env only; remove for Profile C

# Base URLs (match P7-PORT-MATRIX Profile B)
export PLAYWRIGHT_BASE_URL=http://${VPS_IP}:3000
export SMOKE_MARKETING_BASE_URL=http://${VPS_IP}:3002
export SMOKE_PORTAL_BASE_URL=http://${VPS_IP}:3003

pnpm run p7:gate

# Host bind
TOUR_OPS_API_URL="$TOUR_OPS_API_URL" node scripts/smoke-p6-host-bind.mjs

# Portal — SMK-PTL-01 · SMK-PTL-02 · SMK-PTL-04
pnpm --filter @apps/portal run test:smoke

# Marketing — SMK-MKT-03
pnpm --filter @apps/marketing run test:smoke

# Admin — VS-01 · VS-06 · VS-07 (fa-IR status strings)
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts -g "SMK-P6-VS-01"
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts -g "SMK-P9-04"
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts -g "SMK-P6-ADM-02"
```

---

## Profile C — Subdomain staging (copy-paste)

Replace `{club}` and `{root}` (example club `denali`, root `staging.example.com`).

```bash
export CLUB=denali
export ROOT=staging.example.com
export TOUR_OPS_API_URL=https://api.${ROOT}
export PW_EXTERNAL_SERVERS=1
export PW_NO_REUSE_SERVER=1

export PLAYWRIGHT_BASE_URL=https://${CLUB}.admin.${ROOT}
export SMOKE_MARKETING_BASE_URL=https://${CLUB}.${ROOT}
export SMOKE_PORTAL_BASE_URL=https://${CLUB}.portal.${ROOT}

# Profile C — real SMS; no static OTP
# AUTH_ALLOW_DEV_STATIC_OTP must be false on API

pnpm run p7:gate
TOUR_OPS_API_URL="$TOUR_OPS_API_URL" node scripts/smoke-p6-host-bind.mjs

pnpm --filter @apps/portal run test:smoke
pnpm --filter @apps/marketing run test:smoke
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts -g "SMK-P6-VS-01"
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts -g "SMK-P9-04"
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts -g "SMK-P6-ADM-02"
```

---

## Scenario matrix (staging)

| ID | VS | Env vars | Spec |
| -- | -- | -------- | ---- |
| SMK-P7-INFRA-01 | — | `TOUR_OPS_API_URL` | `smoke-p6-host-bind.mjs` |
| SMK-P6-VS-01 | VS-01 | `PLAYWRIGHT_BASE_URL` | `p6-admin-publish-smoke.spec.ts` |
| SMK-P6-MKT-03 | VS-02/03 | `SMOKE_MARKETING_BASE_URL` | `marketing-catalog-smoke.spec.ts` |
| SMK-P6-PTL-01 | VS-03 | `SMOKE_PORTAL_BASE_URL` | `portal-registration-smoke.spec.ts` |
| SMK-P6-PTL-02 | VS-04 | same | `portal-member-smoke.spec.ts` |
| SMK-P6-PTL-04 | VS-05 | same | `portal-member-smoke.spec.ts` |
| SMK-P9-04 | VS-06 | `PLAYWRIGHT_BASE_URL` | `operator-smoke.spec.ts` |
| SMK-P6-ADM-02 | VS-07 | `PLAYWRIGHT_BASE_URL` | `p6-operator-receipt-approve-smoke.spec.ts` |

---

## T3 — Postgres finance (same session)

```bash
export DATABASE_URL=postgresql://app_tour:...@127.0.0.1:5433/tour_db_prod
pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts
```

Requires `STORAGE_DRIVER=prisma` on staging API.

---

## Failure triage (staging-specific)

| Symptom | Check |
| ------- | ----- |
| Playwright starts local servers | `PW_EXTERNAL_SERVERS=1` set |
| Wrong tenant | `PUBLIC_TENANT_FALLBACK_*` (Profile B) · DNS hosts (Profile C) |
| Catalog stale after publish | `MARKETING_REVALIDATE_URL` on API → marketing `/api/revalidate` · secrets match |
| OTP fails Profile C | SMS provider env on API · static OTP off |
| Admin 404 on bare IP path | Use admin **host** URL, not `127.0.0.1:3000` without tenant fallback |
| VS-06 status assertion | UI fa-IR — expect `تأییدشده` not `approved` |
| SMK-PTL-04 receipt `500` / `RECEIPT_UPLOAD_FAILED` | Postgres + `STORAGE_DRIVER=prisma`: `PrismaBookingsRepository.getById` must use admin PK lookup — app pool without `withTenantRls` returns `null` → member receipt path fails before finance write |
| Portal register `404` / no `data-registration-ready` | Tour `…0210` relocated to denali dev tenant `…003` by API bootstrap after seed — ensure `seedOperatorSmokePublishedTour` keeps canonical operator tenant `…014`; re-run `ensure-operator-smoke-vs01-staging.ts` after API restart |
| SMK-P6-ADM-02 VS-07 seed fails (paid payment) | `seed-operator-smoke-pending-booking-staging.ts` clears payments/receipts for …0310 before upsert — re-run probe pre-seed |
| SMK-P6-ADM-02 timeout (20+ pending receipts) | Seed script purges **all** tenant …014 `Pending` receipts/payments then upserts stable VS-07 row (`…0408` / `p6-vs07-smoke.jpg`); smoke approves via operator BFF `PATCH /api/finance/receipts/{id}/review` after UI queue assertion |
| SMK-MKT-03 timeout on register navigation | `PORTAL_PUBLIC_BASE_URL` must be `http://operator.portal.localhost:230xx` (not bare VPS IP) so Playwright host-resolver reaches portal through SSH tunnel — bare IP hangs on `load` |
| Portal register stuck (no `data-registration-ready`) | Runner ISP intercept on bare VPS IP — use probe SSH tunnels (`VPS_IP=127.0.0.1`) |
| `portal static chunk` / tunnel sanity `000` | Partial SSH forward (only `:23000`) or stale tunnel — probe now requires all four ports + `/health` 200; kill old `ssh -L` or re-run probe |

---

## Exit signal (P7-3-N-001)

All SMK rows above green on chosen staging profile · recorded in [p7-exit-checklist.md](../p7-exit-checklist.md) VS staging column.

## References

- [P7-PORT-MATRIX.md](../appendices/P7-PORT-MATRIX.md)
- [p6-e2e-smoke.md](../../phase-19/p6/runbooks/p6-e2e-smoke.md)
- [p7-customer-sign-off.md](p7-customer-sign-off.md)
