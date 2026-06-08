/**
 * Phase 8.4 — owner dev session host for SMK-P8-03.
 * @see docs/phase-8/appendices/SMOKE-SCENARIO-MAP.md
 */
export const URBAN_OWNER_E2E_BASE_URL =
  process.env.SMOKE_OWNER_WEB_BASE_URL ?? "http://urban-owner.localhost:3000";

export const URBAN_OWNER_SETTINGS_PATH = "/settings/urban" as const;
