/**
 * SMK-P7-01 — urban demo tenant fixture (static registry / memory integration).
 * @see docs/phase-7/appendices/SMOKE-SCENARIO-MAP.md
 */
import { URBAN_SMOKE_SUBDOMAIN, URBAN_SMOKE_TENANT_ID } from "@app-tour/workspace-urban";

export const urbanDemoTenant = {
  id: URBAN_SMOKE_TENANT_ID,
  subdomain: URBAN_SMOKE_SUBDOMAIN,
  workspaceType: "urban" as const,
};

export { URBAN_SMOKE_SUBDOMAIN, URBAN_SMOKE_TENANT_ID };
