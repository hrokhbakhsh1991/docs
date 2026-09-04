# FULL-WALLET-V1-REQUIREMENT-MATRIX

**Feature:** Member Wallet bounded context (WALLET-ADR-001 / WALLET-P0-001)  
**Branch:** `cursor/gamification-5bda`  
**Activation classification:** `ACTIVE`  
**Denali runtime activation:** default club (`…000003`) + pilot (`…000430`) — theme `enabledModules: ["wallet"]` + `portalModuleGrants`  
**Urban/starter:** `WALLET_WORKSPACE_UNSUPPORTED` (no manifest block)  
**Operator ticketing tenant (`…000014`):** wallet disabled (ticketing only)

Authority: `docs/architecture/wallet-module-phase-0-contract.mdoc`, `docs/architecture/adr/ADR-WALLET-001-member-wallet-bounded-context.mdoc`

---

## Monetary model (repository evidence)

| Topic | Decision | Source |
| ----- | -------- | ------ |
| Storage unit | Integer **minor units** (`amountMinor` string, bigint-safe) | Prisma `wallet_transactions`, `wallet-core` |
| Currency | Workspace/tenant theme `commerce.currency` (Denali: **IRR**) | tenant theme |
| Display | `Intl.NumberFormat` — IRR zero-decimal via `isZeroDecimalWalletCurrency` | `member-wallet-format.ts` |
| Available vs total | `balanceMinor` + `availableBalanceMinor` on summary | `WalletMemberSummaryHttpResponse` |
| Pending/held/debt | **EXPLICITLY_OUT_OF_SCOPE** V1 | WALLET-P0-001 non-goals |
| Negative balance | Debit rejected → `WALLET_INSUFFICIENT_FUNDS` | `wallet-core` domain tests |
| Float | **Forbidden** — integer minor only | ADR-WALLET-001 |
| Finance ledger | Separate bounded context | ADR-WALLET-001, `denali-refund-wallet-credit` |

---

## Capability matrix

| ID | Capability | Status | Evidence |
| -- | ---------- | ------ | -------- |
| W1 | `workspaceWallet` manifest (Denali) | **COMPLETE** | `packages/workspaces/denali/workspace.manifest.json` |
| W2 | Codegen bindings + HTTP routes | **COMPLETE** | `workspace-wallet-bindings.generated.ts`, `wallet-http` |
| W3 | Urban/starter wallet | **EXPLICITLY_OUT_OF_SCOPE** | No manifest block → `WALLET_WORKSPACE_UNSUPPORTED` |
| W4 | Prisma schema + RLS FORCE | **COMPLETE** | `20260902120000_wallet_member_accounts_rls` |
| W5 | Member account + immutable ledger | **COMPLETE** | `wallet_accounts`, `wallet_transactions`, `wallet_ledger_entries` |
| W6 | Operator credit/debit/reversal | **COMPLETE** | `wallet-http` POST handlers + idempotency |
| W7 | Member read balance/history | **COMPLETE** | `GET /wallet/me/balance`, `/wallet/me/transactions` |
| W8 | Portal BFF `/api/me/wallet` | **COMPLETE** | `apps/portal/app/api/me/wallet/route.ts` |
| W9 | Portal `/me/wallet` page | **COMPLETE** | `MemberWalletPageContent` |
| W10 | Operator `/wallet` ops panel | **COMPLETE** | `WalletOpsPanel` |
| W11 | Operator nav gating | **COMPLETE** | `wallet-nav-enablement.ts` |
| W12 | Member nav + entitlement | **COMPLETE** | `member.module.wallet`, `portalModuleGrants` |
| W13 | Module enablement gate | **COMPLETE** | `isWalletModuleEnabled`, `defaultModuleEnabledWhenUnset: false` |
| W14 | Postgres-only runtime | **COMPLETE** | `wallet-repository.factory` rejects memory driver |
| W15 | Outbox → member notifications | **COMPLETE** | `WALLET-NOTIF-01` Playwright + `run-wallet-outbox-relay-once.ts` |
| W16 | Gateway top-up / withdrawals | **DISABLED** | manifest `gatewayTopUp: false`, `withdrawals: false` |
| W17 | Denali default club activation | **COMPLETE** | tenant-registry + seed `…000003`; `WALLET-DEFAULT-*` Playwright |
| W18 | Denali pilot activation | **COMPLETE** | tenant `…000430`; `WALLET-PILOT-*` Playwright |
| W19 | Dashboard wallet summary (gamification) | **COMPLETE** | `member-dashboard-wallet-summary.server.ts` |
| W20 | Engagement↔Wallet coupling | **COMPLETE** (none) | Separate BFF fetches; WALLET-NOTIF-01 points unchanged |
| W21 | Postgres certification suite | **COMPLETE** | `test:wallet-postgres-certification` — 30/30 pass |
| W22 | Playwright member/operator cert | **COMPLETE** | `test:certify:denali-wallet-v1` (10/10) + pilot operator (4/4) |
| W23 | Dashboard integration E2E | **COMPLETE** | `WALLET-DEFAULT-MEG-*` + `WALLET-MEG-*`; desktop + mobile screenshots |
| W24 | Denali ledger policy adapter | **EXPLICITLY_OUT_OF_SCOPE** | WALLET-P0-001 §9.2 manifest scaffold only; no V1 runtime port |
| W25 | Staging deploy runbook | **COMPLETE** | `docs/phase-23/runbooks/denali-wallet-v1-staging-deploy.md` |

---

## Activation chain (Denali — default + pilot)

```
denali.workspace.manifest.json workspaceWallet.supported=true
  → workspace-wallet-bindings.generated.ts
  → configure-wallet-http-host.ts + lazy handlers
  → tenant theme enabledModules: ["wallet"] + portalModuleGrants: ["wallet"]
  → isWalletModuleEnabled() === true
  → Portal: /me/wallet + dashboard wallet summary
  → Web: /wallet operator ops (denali.admin.localhost + pilot admin host)
```

**Proof commands (Postgres):**

- `pnpm --filter @apps/api run seed:denali-wallet-v1`
- `pnpm --filter @apps/portal run test:certify:denali-wallet-v1` — 10 passed
- `pnpm --filter @apps/web run test:certify:denali-wallet-pilot` — 4 passed
- `pnpm --filter @apps/web exec playwright test -c playwright.wallet-ws1-certification.config.ts` — includes `WALLET-CERT-D01`
- `pnpm --filter @apps/api run test:wallet-postgres-certification` — 30 passed

**Browser artifacts:** `/opt/cursor/artifacts/denali-default-dashboard-wallet-engagement-*.png`, `denali-dashboard-wallet-engagement-*.png`, `denali-wallet-notification-inbox.png`

---

## Points ≠ Wallet (integration rules)

| Rule | Status |
| ---- | ------ |
| Engagement points not stored as money | **COMPLETE** |
| Wallet balance not in engagement tables | **COMPLETE** |
| Gamification does not import wallet repository | **COMPLETE** |
| Dashboard: separate sections + visual treatment | **COMPLETE** |
| Currency only on wallet values | **COMPLETE** |
| Wallet failure does not break engagement | **COMPLETE** |

---

## Verification ledger (gap closure)

| Check | Result |
| ----- | ------ |
| `guard:repository-rls` | PASS |
| `guard:tenant-isolation` (@apps/api) | PASS |
| `guard:api-workspace-isolation` | PASS |
| `guard:import-boundary` | PASS |
| `guard:migration-head-preflight` | PASS |
| `prisma migrate status` | up to date (94 migrations) |
| `@apps/api` build | PASS |
| `@apps/portal` build | PASS |
| `@apps/web` build | PASS |
| `doc:markdoc:validate` | PASS (309 files) |
| `pre-commit:fast` | PASS |

**Verdict:** `WALLET_V1_AND_GAMIFICATION_INTEGRATION_COMPLETE`
