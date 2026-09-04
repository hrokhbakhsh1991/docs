/**
 * Denali default club wallet fixture (tenant …000003) — seed + E2E SoT.
 */
import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

export const DENALI_DEFAULT_WALLET = {
  tenantId: DENALI_SMOKE_TENANT_ID,
  subdomain: "denali",
  workspaceId: "ws-denali-dev",
  ownerUserId: "00000000-0000-4000-8000-000000000101",
  entitledMemberUserId: "00000000-0000-4000-8000-000000000437",
  deniedMemberUserId: "00000000-0000-4000-8000-000000000438",
  accountId: "00000000-0000-4000-8000-000000000439",
  ownerMobile: "09174070937",
  entitledMemberMobile: "09174070941",
  deniedMemberMobile: "09174070942",
  devOtp: "1234",
  currency: "IRR",
  seededBalanceMinor: "40000",
} as const;
