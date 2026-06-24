# P6 — Smoke scenario map (SMK-P6)

```yaml
smoke_version: "2026-06-22-bundle-c"
phase: 19
authority: platform-denali-vertical-slice.mdoc · SMOKE-SCENARIO-MAP-P6.md
fixture_tenant: operator · 00000000-0000-4000-8000-000000000014
gate_product: pnpm run p6:gate
gate_e2e: pnpm run p6:e2e-gate   # product + browser — P6_E2E_GATE_OK
```

> **Agents:** Product gate (`p6:gate`) runs unit/static specs. Browser smokes run via `pnpm run p6:e2e-gate` → `P6_E2E_GATE_OK`. Postgres finance depth: `pnpm run p6:staging-gate` when `DATABASE_URL` is set.

---

## Summary matrix

| ID | Title | VS | Playwright / script | Unit gate spec | Pass signal |
| -- | ----- | -- | ------------------- | -------------- | ----------- |
| **SMK-P6-HOST-01** | Three canonical hosts same tenant | — | `scripts/smoke-p6-host-bind.mjs` (also in operator E2E bootstrap) | `p6-host-tenant-parity.spec.ts` | same `tenantId` on marketing · portal · admin |
| **SMK-P6-VS-01** | Admin publish → catalog | VS-01 | `p6-admin-publish-smoke.spec.ts` SMK-P6-VS-01 | `p6-vs01-admin-publish.spec.ts` | catalog visibility · publish transition API |
| **SMK-P6-VS-CHAIN-B01** | Browser chain guest API + operator UI | VS-03..07 | `p6-vertical-slice-browser-chain.spec.ts` | `p6-vertical-slice-chain.spec.ts` | same `bookingId` · bookings + finance UI |
| **SMK-P6-MKT-01** | Marketing lists active tour | VS-02 | `marketing-catalog-smoke.spec.ts` (SMK-MKT-03) | `p6-guest-slice.spec.ts` GS-02 | tour card visible |
| **SMK-P6-MKT-02** | CTA → portal canonical URL | VS-03 | same (SMK-MKT-03) | `resolve-web-registration-url.spec.ts` MKT-08 | URL contains `.portal.` |
| **SMK-P6-PTL-01** | Portal OTP register success | VS-03 | `portal-registration-smoke.spec.ts` | `p6-guest-slice.spec.ts` GS-01 | `[data-public-registration-success]` |
| **SMK-P6-PTL-02** | Portal `/me` lists registration | VS-04 | `portal-member-smoke.spec.ts` SMK-PTL-02 | `portal-member-registrations.spec.ts` MEM-BFF-01 | row visible after intake |
| **SMK-P6-PTL-05** | Portal home → `/me/registrations` | VS-04 | `portal-member-smoke.spec.ts` SMK-PTL-05 | `portal-home-redirect.spec.ts` MEM-HOME-01 | redirect when session cookie set |
| **SMK-P6-VS-CHAIN** | One booking VS-03→06→05→07 | VS-03..07 | — (browser smokes remain isolated) | `p6-vertical-slice-chain.spec.ts` P6-VS-CHAIN-01 | same `bookingId` through register · approve · receipt · finance |
| **SMK-P6-PTL-03** | Member list BFF | VS-04 | — | `portal-member-registrations.spec.ts` MEM-BFF-01 | proxies `bookings?view=mine` |
| **SMK-P6-PTL-04** | Member receipt upload | VS-05 | `portal-member-smoke.spec.ts` SMK-PTL-04 | `p6-member-receipt-flow.spec.ts` | receipt 201 + success marker |
| **SMK-P6-ADM-01** | Operator approve booking | VS-06 | `operator-smoke.spec.ts` SMK-P9-04 | `bookings-ops.spec.ts` API-9.5-01 | approve + outbox · E2E in `p6:e2e-gate` |
| **SMK-P6-ADM-02** | Operator approve receipt | VS-07 | `p6-operator-receipt-approve-smoke.spec.ts` SMK-P6-ADM-02 | `p6-member-receipt-flow.spec.ts` P6-MR-03 · `p6-offline-receipt-gate.spec.ts` | finance approve · E2E in `p6:e2e-gate` |
| **SMK-P6-EXIT-02** | Full E2E gate | VS-08 | — | `pnpm run p6:e2e-gate` | `P6_E2E_GATE_OK` |
| **SMK-P6-EXIT-01** | Product gate green | VS-08 | — | `platform-denali-first-customer-exit.spec.ts` | `P6_DENALI_PRODUCT_GATE_OK` |

**Full E2E runbook (T2):** [runbooks/p6-e2e-smoke.md](../runbooks/p6-e2e-smoke.md) · CI: `p6-denali-gate.yml`

---

## Host / env (all scenarios)

| Surface | Canonical dev URL | Legacy alias |
| ------- | ----------------- | ------------ |
| Marketing | `http://operator.localhost:3002` | `http://shop.operator.localhost:3002` |
| Portal | `http://operator.portal.localhost:3003` | `http://operator.localhost:3003` |
| Admin | `http://operator.admin.localhost:3000` | `http://operator.localhost:3000` |

**Playwright portal config:** `apps/portal/playwright.portal.config.ts` → `baseURL: http://operator.portal.localhost:3003`

**CTA bridge:** `buildDevPortalPublicBaseUrl` in `@app-tour/tenant-kernel` — do not duplicate in apps.

---

## Commands

```bash
# Product gate (required for P6 closure)
pnpm run p6:gate

# Host bind smoke (servers must be running)
node scripts/smoke-p6-host-bind.mjs

# Full E2E gate (VS-01..07 browser + product)
pnpm run p6:e2e-gate   # → P6_E2E_GATE_OK
pnpm --filter @apps/portal run test:smoke   # SMK-PTL-01
pnpm --filter @apps/marketing run test:smoke # SMK-MKT-03
```

---

## Supporting artifacts

| Artifact | Path | Role |
| -------- | ---- | ---- |
| Vertical slice SoT | `docs/phase-19/platform-denali-vertical-slice.mdoc` | VS-01..08 steps |
| Guest runbook | `docs/phase-19/p6/runbooks/guest-slice-operator-minimal.md` | VS-01..03 manual |
| Operator runbook | `docs/phase-19/p6/runbooks/first-customer-operator.md` | VS-06..07 manual |
| Gate script | `scripts/p6-denali-product-gate.sh` | VS-08 composition |
| State map | `docs/phase-19/p6/AGENT-STATE-MAP-P6.md` | ASM-P6 triggers |
| Finance DB note | `appendices/FINANCE-OPS-P6-NOTE.md` | finance-ops when DATABASE_URL |
| OTP scope | `appendices/OTP-SCOPE-P6.md` | G-P6-UI-05 intentional |

---

## References

- [TRACEABILITY-MATRIX-P6.md](TRACEABILITY-MATRIX-P6.md)
- [phase-9/appendices/SMOKE-SCENARIO-MAP.md](../../phase-9/appendices/SMOKE-SCENARIO-MAP.md) — pattern reference
