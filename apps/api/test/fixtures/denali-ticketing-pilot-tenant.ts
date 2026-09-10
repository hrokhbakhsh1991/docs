/**
 * Phase F1 — Denali Ticketing pilot fixture (seed + E2E + Postgres specs).
 */
import {
  DENALI_TICKETING_PILOT_SUBDOMAIN,
  DENALI_TICKETING_PILOT_TENANT_ID,
} from "@app-tour/workspace-denali";

export const DENALI_TICKETING_PILOT = {
  tenantId: DENALI_TICKETING_PILOT_TENANT_ID,
  subdomain: DENALI_TICKETING_PILOT_SUBDOMAIN,
  workspaceId: "ws-denali-ticketing-pilot",
  memberUserId: "00000000-0000-4000-8000-000000000437",
  memberMobile: "09174070941",
  devOtp: "1234",
} as const;
