# FULL-WALLET-V1-REQUIREMENT-MATRIX

**Feature:** Member Wallet bounded context (WALLET-ADR-001 / WALLET-P0-001)  
**Branch:** `cursor/gamification-5bda`  
**Activation classification (Phase 0):** `ACTIVE_BUT_PARTIAL`  
**Denali runtime activation:** `denali-wallet-pilot` tenant (`…000430`) — theme `enabledModules: ["wallet"]` + `portalModuleGrants`  
**Default Denali club smoke (`…000003`):** Wallet **DISABLED** by design (`WALLET-CERT-D01`)

Authority: `docs/architecture/wallet-module-phase-0-contract.mdoc`, `docs/architecture/adr/ADR-WALLET-001-member-wallet-bounded-context.mdoc`

---

## Monetary model (repository evidence)

| Topic | Decision | Source |
| ----- | -------- | ------ |
| Storage unit | Integer **minor units** (`amountMinor` string, bigint-safe) | Prisma `wallet_transactions`, `wallet-core` |
| Currency | Workspace/tenant theme `commerce.currency` (Denali pilot: **IRR**) | `denali-wallet-pilot` tenant theme |
| Display | `Intl.NumberFormat` — IRR zero-decimal via `isZeroDecimalWalletCurrency` | `member-wallet-format.ts` |
| Available vs total | `balanceMinor` + `availableBalanceMinor` on summary | `WalletMemberSummaryHttpResponse` |
| Pending/held/debt | **EXPLICITLY_OUT_OF_SCOPE** V1 (no separate held ledger) | WALLET-P0-001 non-goals |
| Negative balance | Debit rejected → `WALLET_INSUFFICIENT_FUNDS` | `wallet-core` domain tests |
| Float | **Forbidden** — integer minor only | ADR-WALLET-001 |
| Finance ledger | Separate bounded context; refund credit via explicit `credit-to-wallet` contract | ADR-WALLET-001, `denali-refund-wallet-credit` |

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
| W13 | Module enablement gate | **COMPLETE** | `isWalletModuleEnabled`, `defaultModuleEnabledWhenUnset: false` (Denali) |
| W14 | Postgres-only runtime | **COMPLETE** | `wallet-repository.factory` rejects memory driver |
| W15 | Outbox → member notifications | **COMPLETE** | `dispatch-wallet-notification-from-outbox.ts` |
| W16 | Gateway top-up / withdrawals | **DISABLED** | manifest `gatewayTopUp: false`, `withdrawals: false` |
| W17 | Denali default club activation | **DISABLED** | Tenant `…000003` — `WALLET-CERT-D01` |
| W18 | Denali pilot activation | **COMPLETE** | Tenant `…000430`, seed `seed-denali-wallet-pilot.ts` |
| W19 | Dashboard wallet summary (gamification) | **COMPLETE** | `member-dashboard-wallet-summary.server.ts`, WALLET-MEG-01/02 Playwright |
| W20 | Engagement↔Wallet coupling | **COMPLETE** (none) | Separate BFF fetches; no shared tables |
| W21 | Postgres certification suite | **COMPLETE** | `test:wallet-postgres-certification` |
| W22 | Playwright member/operator cert | **COMPLETE** | `denali-wallet-pilot-*-certification.spec.ts` |
| W23 | Dashboard integration E2E | **COMPLETE** | `denali-wallet-engagement-dashboard.spec.ts` (WALLET-MEG-01/02/03) |
| W24 | Denali ledger policy adapter | **PARTIAL** | Placeholder in `packages/workspaces/denali/src/wallet/` |
| W25 | Staging deploy runbook | **COMPLETE** | `docs/phase-23/runbooks/denali-wallet-v1-staging-deploy.md` |

---

## Activation chain (Denali pilot — proven path)

```
denali.workspace.manifest.json workspaceWallet.supported=true
  → workspace-wallet-bindings.generated.ts
  → configure-wallet-http-host.ts + lazy handlers
  → tenant theme enabledModules: ["wallet"] + portalModuleGrants: ["wallet"]
  → isWalletModuleEnabled() === true
  → Portal: fetchWalletUpstream → /api/me/wallet → MemberWalletPageContent
  → Web: ensureWalletRouteAllowed → /wallet → WalletOpsPanel
  → Dashboard: resolveMemberDashboardWalletSummary → fetchMemberWallet (BFF only)
```

**Proof commands (Postgres required):**

- `pnpm --filter @apps/api run seed:denali-wallet-pilot`
- `pnpm --filter @apps/portal run test:certify:denali-wallet-pilot`
- `pnpm --filter @apps/web run test:certify:denali-wallet-pilot`

---

## Points ≠ Wallet (integration rules)

| Rule | Status |
| ---- | ------ |
| Engagement points not stored as money | **COMPLETE** — separate tables/APIs |
| Wallet balance not in engagement tables | **COMPLETE** |
| Gamification does not import wallet repository | **COMPLETE** — BFF `fetchMemberWallet` only |
| Dashboard: separate sections + visual treatment | **COMPLETE** — engagement metrics vs wallet monetary block |
| Currency only on wallet values | **COMPLETE** — `dir="ltr"` + IRR formatting |
| Wallet failure does not break engagement | **COMPLETE** — independent parallel fetch on home page |

---

## Exclusions / risks

- **Default Denali club (`denali.localhost`)** remains wallet-off until explicit product activation (preserves `WALLET-CERT-D01`).
- **Pilot tenant** is the authoritative Denali wallet activation surface for V1 browser proof.
- **Held/pending/debt** wallet buckets not in V1 UI copy (available = total for pilot).
- **Operator member lookup** uses UUID (existing ops panel); phone search deferred.
- **Memory driver** cannot exercise wallet — Cloud/CI wallet tests require Postgres + `STORAGE_DRIVER=prisma`.

---

## Verification checklist (this delivery)

- [x] `pnpm --filter @apps/portal run test:certify:denali-wallet-pilot` (incl. WALLET-MEG-*)
- [x] Portal lint/build
- [x] Dashboard screenshots with points + IRR balance (`/opt/cursor/artifacts/denali-dashboard-wallet-engagement-*.png`)
- [x] `WALLET_V1_AND_GAMIFICATION_INTEGRATION_COMPLETE` when rows W19/W23 verified
