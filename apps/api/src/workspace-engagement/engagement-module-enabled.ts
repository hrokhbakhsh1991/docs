import {
  isEngagementDefaultEnabledWhenModulesUnset,
  isEngagementSupportedWorkspace,
} from "./workspace-engagement-bindings.generated.ts";
import { resolveEngagementTenantWorkspaceRow } from "./resolve-engagement-workspace-type-for-tenant.ts";

export const ENGAGEMENT_WORKSPACE_UNSUPPORTED = "ENGAGEMENT_WORKSPACE_UNSUPPORTED" as const;
export const FORBIDDEN_ENGAGEMENT_MODULE_DISABLED = "FORBIDDEN_ENGAGEMENT_MODULE_DISABLED" as const;

function parseEnabledModulesFromTheme(theme: unknown): readonly string[] | null {
  if (theme === null || typeof theme !== "object" || Array.isArray(theme)) {
    return null;
  }
  const modules = (theme as { modules?: unknown }).modules;
  if (!Array.isArray(modules)) {
    return null;
  }
  return modules.filter((entry): entry is string => typeof entry === "string");
}

export function isEngagementModuleEnabled(theme: unknown, workspaceType: string): boolean {
  const normalized = workspaceType.trim().toLowerCase();
  if (!isEngagementSupportedWorkspace(normalized)) {
    return false;
  }
  const enabledModules = parseEnabledModulesFromTheme(theme);
  if (enabledModules === null) {
    return isEngagementDefaultEnabledWhenModulesUnset(normalized);
  }
  return enabledModules.includes("engagement");
}

export async function assertEngagementWorkspaceGate(tenantId: string): Promise<{
  readonly workspaceType: string;
  readonly theme: unknown;
}> {
  const row = await resolveEngagementTenantWorkspaceRow(tenantId);
  if (row === null) {
    throw new Error(ENGAGEMENT_WORKSPACE_UNSUPPORTED);
  }
  const workspaceType = row.workspaceType.trim().toLowerCase();
  if (workspaceType.length === 0 || !isEngagementSupportedWorkspace(workspaceType)) {
    throw new Error(ENGAGEMENT_WORKSPACE_UNSUPPORTED);
  }
  if (!isEngagementModuleEnabled(row.theme, workspaceType)) {
    throw new Error(FORBIDDEN_ENGAGEMENT_MODULE_DISABLED);
  }
  return row;
}
