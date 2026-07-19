# Hostile multi-product finance certification

```yaml
cert_id: FINANCE_HOSTILE_MULTI_PRODUCT_CERTIFICATION
version: "1.0"
date: "2026-07-19"
method: simulate 10 production customers × 7 product surfaces; hostile Denali-leak hunt
scope: packages/workspaces/{denali,finance-ws2..ws6} + apps/api workspace-finance + apps/web finance hub
related:
  - FINANCE_HOSTILE_CERTIFICATION_FINAL_V3.md
  - FINANCE_HOSTILE_TENANT_ISOLATION_ABC.md
  - FINANCE_ADAPTER_IDENTITY_STABILITY.md
```

## Verdict

| Claim | Result |
| ----- | ------ |
| Engine can host many tenants with distinct ledger/receipt adapters | **PASS** |
| Ten **distinct enterprise products** each with own ops/dashboards/permissions/workflows | **FAIL** |
| **No Denali assumptions remain** | **FAIL** |
| Ready to sell “10 production customer products” as parity peers | **NO** |

**Classification:** Platform **plugin seam** certified; **product parity** not certified.

Only **five** finance product SKUs are `workspaceFinance.supported` (`denali`, `finance-ws3`…`ws6`). `finance-ws2` is `registryOnly` (architecture proof, no nav/gate). Remaining registry workspaces (`starter`, `urban`, `guest-club`) have **no** `workspaceFinance`.

---

## Simulation: 10 production customers

| Customer | Tenant (sim) | Product type | Product gate | Notes |
| -------- | ------------ | ------------ | ------------ | ----- |
| C01 | `cust-01-denali` | `denali` | supported | Full Path B TourCreated + ops manifest |
| C02 | `cust-02-ws3` | `finance-ws3` | supported | Distinct CoA/receipts; **no** opsManifest |
| C03 | `cust-03-ws4` | `finance-ws4` | supported | Distinct CoA/receipts; **no** opsManifest |
| C04 | `cust-04-ws5` | `finance-ws5` | supported | Distinct CoA/receipts; **has** ops (CAD, installments off) |
| C05 | `cust-05-ws6` | `finance-ws6` | supported | Distinct CoA/receipts; reaction **no-op**; **no** opsManifest |
| C06 | `cust-06-denali-b` | `denali` | supported | Second customer, same SKU — isolation via `tenantId` |
| C07 | `cust-07-ws3-b` | `finance-ws3` | supported | Same SKU as C02; different tenant |
| C08 | `cust-08-ws4-b` | `finance-ws4` | supported | Same SKU as C03 |
| C09 | `cust-09-ws5-b` | `finance-ws5` | supported | Same SKU as C04 |
| C10 | `cust-10-ws2` | `finance-ws2` | **registryOnly** | Ledger/receipt bindings exist; **no** product nav/gate — **not** a shippable customer product |

Isolation unit remains **tenantId** (RLS) + `workspaceType` for adapter selection (`lazy-finance-service` cache). Concurrent C01–C09 do not swap policy mid-request.

---

## Product parity matrix

Legend: **OWN** = workspace-owned distinct binding · **SHARED** = host/platform shared · **GAP** = missing for that SKU · **DENALI-UI** = host UI still Denali-shaped · **STUB** = fixture/no-op.

| Surface | denali | ws2 | ws3 | ws4 | ws5 | ws6 | Parity? |
| ------- | ------ | --- | --- | --- | --- | --- | ------- |
| **Own ledger (CoA + wallet prefix)** | OWN `gl:…` / `booking:` | OWN `ws2:gl:` / `ws2:booking:` | OWN `ws3:` | OWN `ws4:` | OWN `ws5:` | OWN `ws6:` | **YES** (engine) |
| **Own receipt defaults** | IRR / 2500000 | USD / 10000 | EUR / 5000 | GBP / 7500 | CAD / 12500 | AUD / 9900 | **YES** (engine) |
| **Own reports** | SHARED HTTP `/finance/reports/*` (tenant-scoped) | SHARED | SHARED | SHARED | SHARED | SHARED | **NO** product-specific reports |
| **Own ops** | OWN opsManifest (all panels + installments) | GAP | GAP | GAP | OWN (installments **false**, CAD/USD) | GAP | **NO** — only denali+ws5 |
| **Own dashboards** | SHARED web widget + platform `deploy/dashboards/finance-slo.json` | SHARED | SHARED | SHARED | SHARED | SHARED | **NO** per-product dashboards |
| **Own permissions** | SHARED host roles (owner/admin/member + module gate) | SHARED | SHARED | SHARED | SHARED | SHARED | **NO** per-product RBAC matrix |
| **Own workflows** | OWN TourCreated Path B (hostIo) | STUB reaction | STUB | STUB | STUB | STUB **no-op** | **NO** — Denali-only real money workflow |
| **Finance nav / hub** | YES | **NO** (registryOnly) | YES | YES | YES | YES | Partial |
| **Stable capture ids** | OWN seed | OWN | OWN | OWN | OWN | OWN | **YES** |

### Dimension scores (hostile)

| Dimension | Score /10 | Evidence |
| --------- | --------: | -------- |
| Ledger independence | **9** | Distinct CoA + wallet prefixes; no shared GL codes across types |
| Receipt defaults independence | **9** | Distinct currency/amount per adapter; registry-tested |
| Reports productization | **3** | One report API for all; no workspace report packs |
| Ops productization | **4** | Only 2/5 supported SKUs declare `opsManifest`; others render **null** (no Denali fallback — correct fail-closed, not parity) |
| Dashboards productization | **2** | Single hub widget; SRE dashboard is platform-wide |
| Permissions productization | **4** | Platform roles only; module enablement per theme — not product-owned permission catalogs |
| Workflows productization | **3** | Real TourCreated→ledger only Denali; ws* reactions are fixtures |
| Denali-assumption freedom | **3** | See leak table below |

**Parity composite:** **37 / 70** → **FAIL** for “10 peer products.”

---

## Denali assumptions that remain

| # | Assumption | Where | Severity |
| - | ---------- | ----- | -------- |
| 1 | Boot default `BOOT_FINANCE_WORKSPACE_TYPE = "denali"` | `finance-dependency-registry.ts` | P1 — legacy boot path |
| 2 | Web currency fallbacks default to **IRR** | `finance-*-logic.ts`, panels form defaults | P1 — wrong UX for ws3–6 |
| 3 | UI chrome `DenaliSkeleton` / `data-denali-surface` | `apps/web/src/finance/*` | P2 — branding leak |
| 4 | Generated HTTP handlers named `DENALI_FINANCE_HTTP_*` | `workspace-http-routes.generated.ts` | P2 — naming; SoT is `@app-tour/finance-http` |
| 5 | `assertDenaliFinanceWorkspace` | denali `finance-ops-manifest.ts` | P2 — package-local guard |
| 6 | Full TourCreated money path only on Denali (`requiresHostIo: true`) | manifests + reaction adapters | P0 for “peer workflows” |
| 7 | Ops UI missing → empty hub (ws3/4/6) | ops bindings only denali+ws5 | P0 for “own ops” claim |
| 8 | Prisma/in-memory fallbacks `currency ?? "IRR"` | repository paths | P1 |

**What is *not* a Denali assumption (PASS):**

- Capability gate / nav bindings are **codegen** from manifests (no hardcoded `["denali"]` product list in gate).
- Ops resolution has **no Denali fallback** when unbound (`finance-ops-panels.ts`).
- `FinanceService` does not import Denali HTTP (ownership specs).
- Ledger capture `domainEventId` formula is payment-based and stable across all registered adapters.

---

## Hostile checks (simulated)

| Scenario | Expectation | Result |
| -------- | ----------- | ------ |
| C02 approve payment | ws3 CoA + EUR receipt defaults; tenant RLS | **PASS** (engine) |
| C02 open finance ops hub | panels from opsManifest | **FAIL** — unbound → null |
| C05 TourCreated | ledger side-effect | **FAIL** as product peer — reaction returns false / handled 0 |
| C01 vs C06 same SKU | no cross-tenant ledger | **PASS** (tenant isolation; not re-proven here — see ABC doc) |
| C10 (ws2) as sold product | nav + gate | **FAIL** — registryOnly |
| UI create payment on C04 without currency | use CAD defaults | **PARTIAL** — adapter defaults CAD; form still seeds IRR |

---

## Answers

1. **Do 10 customers each get own ledger / receipt defaults?**  
   Yes for types that are registered (C01–C09 via denali/ws3–6). Ledger and receipt ports are per-`workspaceType`.

2. **Own reports / ops / dashboards / permissions / workflows?**  
   **No** as product-owned packs. Reports, dashboards, and permissions are **shared platform**. Ops only for denali+ws5. Workflows only Denali is production-real.

3. **No Denali assumptions remain?**  
   **No.** Boot default, IRR UI fallbacks, Denali UI chrome, and Denali-only TourCreated money path remain.

4. **Enterprise “10 products” certification?**  
   **NOT CERTIFIED.** Platform multi-tenant + multi-type **engine** is certified; product parity is not.

---

## Exit criteria for parity PASS

1. Every `supported` finance workspace declares `opsManifest` (or host proves intentional empty product).
2. Remove IRR hard-defaults from generic web; seed from receipt-defaults / ops currencies.
3. TourCreated (or equivalent) money workflow implemented — not no-op — for each sold SKU, **or** document SKUs as “ledger-only / no auto-accrual.”
4. Boot default not hard-coded to denali in production configs (env-required).
5. Optional: per-product report packs / dashboard widgets if marketing claims “own reports/dashboards.”
6. Expand beyond fixtures if claiming **ten** distinct SKUs (today: five supported + one registry-only).

---

## Evidence index

| Artifact | Role |
| -------- | ---- |
| `workspace.manifest.json` × denali, ws2–6 | Product declarations |
| `workspace-finance-*-bindings.generated.ts` | Host composition |
| `workspace-finance-ops-bindings.generated.ts` | Ops: denali + ws5 only |
| `workspace-finance-nav-bindings.generated.ts` | Nav: denali, ws3–6 |
| `finance-ws*-onboarding.spec.ts` | Onboarding proofs |
| `finance-ops-panels.ts` | Explicit no Denali fallback |
| `BOOT_FINANCE_WORKSPACE_TYPE` | Denali boot residual |
