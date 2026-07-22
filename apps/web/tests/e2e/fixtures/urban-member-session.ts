/**
 * Phase 8.4 — member dev session host for SMK-P8-04.
 * @see docs/phase-8/appendices/SMOKE-SCENARIO-MAP.md
 */
export const URBAN_MEMBER_E2E_BASE_URL =
  process.env.SMOKE_MEMBER_WEB_BASE_URL ?? "http://workspace-member-smoke.localhost:3000";

export const URBAN_MEMBER_SETTINGS_PATH = "/settings/urban" as const;
