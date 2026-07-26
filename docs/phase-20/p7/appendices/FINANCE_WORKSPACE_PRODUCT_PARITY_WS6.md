# Finance workspace product parity — `finance-ws6` simulation

```yaml
audit_id: FINANCE_WORKSPACE_PRODUCT_PARITY_WS6
version: "1.0"
date: "2026-07-19"
question: Can a new workspace become a first-class finance customer?
subject: workspace-finance-ws6 (package + manifest + adapters + codegen)
```

## Verdict

**YELLOW overall — API/plugin-capable, not a first-class finance customer.**

`finance-ws6` clears the **engine onboarding** bar (proven by `finance-ws6-onboarding.spec.ts`). It does **not** clear **operator product parity** with Denali (ops panels, web dep, HTTP ownership, UX chrome, HostIo-rich reactions).

---

## Onboarding checklist (required)

| Step | ws6 status |
| ---- | ---------- |
| Package `packages/workspaces/finance-ws6` | Present |
| Manifest `workspaceFinance.supported` | Present |
| Adapters (ledger, receipt, CoA, reaction) | Present |
| Codegen bindings | Present (API) |
| `apps/api` `package.json` dep | Present |
| `opsManifest` | **Missing** |
| `apps/web` `package.json` dep | **Missing** |

---

## GREEN / YELLOW / RED matrix

| Surface | Rating | Evidence (ws6 vs Denali) |
| ------- | ------ | ------------------------ |
| **Package / manifest / adapters / codegen** | **GREEN** | Onboarding spec: supported, defaults, ledger, receipt, CoA, reaction resolve without hand-registry edits |
| **Permissions (capability + authz)** | **GREEN** | Same gate: `isFinanceSupportedWorkspace` + module enablement + operator/member authz ports — not Denali-hardcoded |
| **Ledger policy** | **GREEN** | `FinanceWs6LedgerPolicyAdapter` bound via dependency codegen |
| **Receipt defaults** | **GREEN** | AUD/`9900` defaults resolve via registry |
| **Chart of accounts** | **GREEN** | `FINANCE_WS6_LEDGER_ACCOUNTS` / `ws6:` accounts registered |
| **Event reactions** | **YELLOW** | Bound with `requiresHostIo: false`; Denali uses `requiresHostIo: true` + fuller HostIo (claim/log). ws6 reaction is fixture-grade, not Denali-parity |
| **Navigation (hub link)** | **GREEN** | `isFinanceNavPlugin("finance-ws6")` (manifest `workspaceFinance.supported`; Set private Phase 4c) |
| **HTTP exposure** | **YELLOW** | Shared `/finance/*` via `@app-tour/finance-http` works for any tenant once type resolves — but route **registration is Denali manifest-owned** (`DENALI_FINANCE_HTTP_ROUTE_MANIFEST_*` in generated routes). ws6 declares **no** `httpRoutes` |
| **Reports (API summary/lists)** | **GREEN** | Same finance-http handlers → `FinanceService` for tenant’s type — no Denali-only report API |
| **Ops panels** | **RED** | No `opsManifest` → `hasFinanceOpsManifest("finance-ws6")` false → `resolveFinanceOpsCapabilityForHub` → **`null`** (empty command center). Only `denali` + `finance-ws5` in ops bindings |
| **Dashboards (admin widget)** | **YELLOW** | Visibility gated by `shouldShowFinanceNav(pluginId)` → **GREEN path for ws6**. Widget UI still **Denali-skinned** (`DenaliSkeleton`, `data-denali-*`) — product chrome not workspace-neutral |
| **First-class customer (overall)** | **YELLOW→RED** | Can take finance API traffic; cannot ship Denali-equivalent ops UX without more human product work |

Legend: **GREEN** = first-class ready · **YELLOW** = works with caveats / Denali coupling · **RED** = blocks first-class claim.

---

## Remaining Denali-only assumptions

| # | Assumption | Impact on ws6 |
| - | ---------- | ------------- |
| 1 | **Finance HTTP routes registered only under Denali’s `httpRoutes` group** | ws6 tenants use Denali-registered global `/finance` mounts; removing Denali from monorepo would drop HTTP unless another owner appears |
| 2 | **Boot default `BOOT_FINANCE_WORKSPACE_TYPE = "denali"`** | Non-HTTP/lazy boot still Denali-centric |
| 3 | **Ops manifest optional; Denali (+ws5) only bound** | ws6 hub panels empty |
| 4 | **`apps/web` does not depend on `@app-tour/workspace-finance-ws6`** | Even if opsManifest added, web install/codegen would need the dep (ws5 pattern) |
| 5 | **Event reaction HostIo richness** | Denali production path ≠ ws6 `requiresHostIo: false` stub |
| 6 | **Admin finance UI chrome** | `data-denali-*`, `DenaliSkeleton` in overview/payments/ledger/prepay/receipts/dashboard — cosmetic but Denali-branded |
| 7 | **Shared platform booking adapter** | All types including ws6 use Denali-era booking projection model |
| 8 | **Production customer = Denali** | ws6 is an architecture proof package, not a certified guest/commerce product workspace |
| 9 | **Telegram / catalog / wizard surfaces** | Denali-only product stack — ws6 has minimal `tourWrite` stubs only |
| 10 | **Finance route const naming** | Generated `DENALI_FINANCE_HTTP_ROUTE_MANIFEST_*` names encode Denali as HTTP owner |

---

## What “first-class finance customer” would require (ws6 gap list)

Not a redesign — checklist vs Denali parity:

1. Add `workspaceFinance.opsManifest` (+ panel exports)  
2. Add `@app-tour/workspace-finance-ws6` to **`apps/web/package.json`**  
3. Regenerate ops bindings; verify hub panels non-null  
4. Harden event reaction to production HostIo semantics (or document fixture-only)  
5. Tenant seed with `workspace_type=finance-ws6` + live E2E (payment → receipt → approve → ledger)  
6. Accept or replace Denali UI chrome on finance pages  
7. Clarify HTTP ownership if Denali is ever removed  

Until 1–3 (and ideally 5), rating stays **not first-class**.

---

## Direct answer

**Can a new workspace become a first-class finance customer?**

**Yes, as a pattern** — package + manifest + adapters + codegen + api dep unlock **GREEN** capability, ledger, receipts, CoA, nav, permissions, and API reports.

**No for `finance-ws6` as shipped** — **RED** ops panels and **YELLOW** HTTP/reaction/dashboard chrome mean it is a **drop-in finance plugin proof**, not a Denali-parity finance customer.

---

## Related

| Doc | Role |
| --- | ---- |
| `finance-ws6-onboarding.spec.ts` | Engine drop-in proof |
| [`FINANCE_WORKSPACE_ONBOARDING_LIFECYCLE.md`](./FINANCE_WORKSPACE_ONBOARDING_LIFECYCLE.md) | Human wire steps |
| [`FINANCE_CAPABILITY_SYSTEM_MATURITY.md`](./FINANCE_CAPABILITY_SYSTEM_MATURITY.md) | Optional ops/reaction |
