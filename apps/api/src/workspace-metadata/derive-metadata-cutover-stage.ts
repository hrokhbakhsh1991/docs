import {
  isWorkspaceMetadataEnabledForTenant,
  isWorkspaceMetadataTenantAllowlistConfigured,
} from "./is-workspace-metadata-enabled-for-tenant.ts";
import { isWorkspaceMetadataEnabled } from "./is-workspace-metadata-enabled.ts";

/** P5-A — computed cutover stage (no DB column). `shadow` is CI-only — not returned here. */
export type MetadataCutoverStage = "off" | "pilot" | "live";

export function deriveMetadataCutoverStage(input: {
  readonly tenantId: string;
  readonly workspaceDefinitionId: string | null;
}): MetadataCutoverStage {
  if (!isWorkspaceMetadataEnabled() || !input.workspaceDefinitionId) {
    return "off";
  }
  if (isWorkspaceMetadataTenantAllowlistConfigured()) {
    return isWorkspaceMetadataEnabledForTenant(input.tenantId) ? "pilot" : "off";
  }
  return "live";
}
