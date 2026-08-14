# Finance UX consolidation (PR23 UX-1)

```yaml
doc_id: FINANCE_UX_CONSOLIDATION_PR23_UX1
version: "2026-08-09-v3"
status: IMPLEMENTED
verdict: READY_FOR_D3_B
phase: PR23-UX-1+UX2+browser-qa
locks:
  money_sot: server_invoice_compile_only
  client_ar_math: forbidden
  online_gateway: forbidden
  no_new_domain: true
```

## Goal

Make Finance operable for a first-time operator using **existing** read/mutation APIs only.

## Backend facts available

| Capability | HTTP | UI use |
| ---------- | ---- | ------ |
| Outstanding rows (D1) | `GET /finance/reports/outstanding-balances` | Outstanding tab + Overview preview |
| Tour AR rollup (D2) | `GET /finance/reports/tour-collections` | Outstanding tours + Overview owed-by-tour |
| Exceptions | `GET /finance/exceptions` | Overview Needs action |
| Refunds | `GET/POST /finance/refunds*` | Refunds tab + Overview awaiting action |
| Summary KPIs | `GET /finance/reports/summary` | Collection activity counts |

## Backend facts **missing** (do not invent in UI)

| Capability | Status |
| ---------- | ------ |
| `GET /finance/reports/outstanding-aging` (ageDays / buckets) | Documented D3-B; **not in finance-http** |
| AR CSV export | Documented D3-C; **not shipped** |
| Tenant-wide `totalOutstandingMinor` / `totalCollectedMinor` on summary | **Absent** — Overview must not sum pages client-side |

Aging questions (“how old / which bucket”) remain **blocked** until D3-B HTTP lands.

## IA decisions

1. Soft-hide Commercial Meaning dual toggle until `registrationId` is present.
2. Add **Outstanding** ops panel (Denali default on) consuming D1+D2.
3. Overview: Needs action → Money owed (server rows) → Collection activity → Collected by tour (demoted) → Audit.
4. No new money mutations or client AR arithmetic.

## UX2 polish (existing facts only)

1. Needs action: Follow-ups first; refunds always visible (quiet empty); collection queues as nested Attention.
2. First-customer chrome: short guidance; state/vocab in expandable Help.
3. Exception cancelled-with-balance: Outstanding deep-link (`/finance?tab=outstanding&registrationId=`).
4. Refund Complete success: CTA to Outstanding (+ Payments) for that registration.
5. Localized refund status badges on Overview; softer aging-unavailable copy.
6. Prefill refund amount shows formatted hero; digit field secondary.

## Sequence lock

```text
UX2 (done) → Browser UX QA (operator Playwright: denali-finance-ux2-browser-qa) → optional totals API → D3-B aging → D3-C CSV
```

### Browser QA execution path (repo tooling)

| Piece | Source |
| ----- | ------ |
| Config | `apps/web/playwright.operator.config.ts` |
| Servers | `apps/web/scripts/smoke-operator-e2e-servers.mjs` (API `:3001` + Web `:3000`) |
| Base URL | `http://operator.admin.localhost:3000` (`PLAYWRIGHT_BASE_URL`) |
| Auth | `loginOperatorWithPhone` BFF OTP (`OPERATOR_DEV_OTP`, default `1234`) — no production bypass |
| Spec | `apps/web/tests/e2e/denali-finance-ux2-browser-qa.spec.ts` |
| Run | `pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts denali-finance-ux2-browser-qa.spec.ts` |
| Artifacts | `apps/web/test-results/finance-ux2-browser-qa/*.png` |

### Browser QA result (2026-08-09)

| Matrix | Result |
| ------ | ------ |
| FA desktop 1440 | Pass (Overview hierarchy, Help, Outstanding, Payments, Receipts, Refunds, RTL) |
| EN desktop 1280 | Pass |
| FA mobile 390 | Pass |
| EN mobile 375 | Pass |
| Responsive 1440→375 | Pass (no horizontal overflow) |

| Journey | Result |
| ------- | ------ |
| A Needs action | Pass |
| B Help collapsed | Pass |
| C Exception→Outstanding | No `CANCELLED_PAYMENT_WITH_BALANCE` rows in memory smoke — soft skip |
| D Amount hero | Pass (deep-link prefill; no Paid payment link in smoke) |
| E Complete CTA | No Complete-capable refund in smoke — soft skip |
| F FA refund labels | Pass (localized status vocabulary on Refunds) |
| G Outstanding honesty | Pass (no aging invention; aging copy softened) |

Soft UX3 fix during QA: EN `agingUnavailable` removed the word “overdue” (clarifier was matching operator-forbidden vocabulary).

Reconfirmed: **8/8 Playwright tests passed** (second full run after server restart). Screenshots under `apps/web/test-results/finance-ux2-browser-qa/`.

D3-B may start when Architect accepts this gate (C/E mutation proof optional unless seeded fixtures are required).
