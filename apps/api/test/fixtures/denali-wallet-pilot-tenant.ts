/**
 * Phase 2 — Denali Wallet pilot fixture (single SoT for seed + E2E + Postgres specs).
 * @see docs/architecture/wallet-module-phase-0-contract.mdoc §10
 */
import {
  DENALI_WALLET_PILOT_SUBDOMAIN,
  DENALI_WALLET_PILOT_TENANT_ID,
} from "@app-tour/workspace-denali";

export const DENALI_WALLET_PILOT = {
  tenantId: DENALI_WALLET_PILOT_TENANT_ID,
  subdomain: DENALI_WALLET_PILOT_SUBDOMAIN,
  workspaceId: "ws-denali-wallet-pilot",
  ownerUserId: "00000000-0000-4000-8000-000000000432",
  entitledMemberUserId: "00000000-0000-4000-8000-000000000433",
  deniedMemberUserId: "00000000-0000-4000-8000-000000000434",
  zeroBalanceMemberUserId: "00000000-0000-4000-8000-000000000431",
  accountId: "00000000-0000-4000-8000-000000000435",
  zeroBalanceAccountId: "00000000-0000-4000-8000-000000000440",
  ownerMobile: "09174070938",
  entitledMemberMobile: "09174070939",
  deniedMemberMobile: "09174070940",
  zeroBalanceMemberMobile: "09174070943",
  devOtp: "1234",
  currency: "IRR",
  /** Seeded balance after deterministic credit/debit history (40,000 IRR). */
  seededBalanceMinor: "40000",
} as const;
