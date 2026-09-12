/**
 * WALLET-P3C — stable certification fixture (single SoT for E2E + Postgres seed).
 * @see docs/architecture/wallet-module-phase-0-contract.mdoc §8
 */
import { WALLET_WS1_SMOKE_TENANT_ID } from "@app-tour/workspace-wallet-ws1";

export const WALLET_WS1_CERTIFICATION = {
  tenantId: WALLET_WS1_SMOKE_TENANT_ID,
  workspaceId: "00000000-0000-4000-8000-000000000421",
  ownerUserId: "00000000-0000-4000-8000-000000000422",
  entitledMemberUserId: "00000000-0000-4000-8000-000000000423",
  deniedMemberUserId: "00000000-0000-4000-8000-000000000424",
  accountId: "00000000-0000-4000-8000-000000000425",
  ownerMobile: "+15550004201",
  entitledMemberMobile: "+15550004202",
  deniedMemberMobile: "+15550004203",
  devOtp: "1234",
  currency: "USD",
  /** Seeded balance after deterministic credit/debit history (45.50 USD). */
  seededBalanceMinor: "4550",
} as const;
