/**
 * Phase 8.4 — stable SMK-P8-* fixture (single SoT).
 * @see docs/phase-8/appendices/SMOKE-SCENARIO-MAP.md
 */
import { URBAN_SMOKE_TENANT_ID } from "@app-tour/workspace-urban";

export const URBAN_SMOKE_E2E = {
  tenantId: URBAN_SMOKE_TENANT_ID,
  workspaceId: "00000000-0000-4000-8000-000000000403",
  ownerUserId: "00000000-0000-4000-8000-000000000401",
  memberUserId: "00000000-0000-4000-8000-000000000402",
  publishedTourId: "00000000-0000-4000-8000-000000000410",
  draftTourId: "00000000-0000-4000-8000-000000000411",
  publishedTourTitle: "Berlin city highlights",
  registrationEmail: "smk-p8-02@urban-smoke.local",
} as const;
