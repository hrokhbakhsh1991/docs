import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { resolveSettingsModuleForTenant } from "./settings-registry";
import { SettingsModuleNotSupportedError, SettingsMutationForbiddenError } from "./settings.service";
import { assertDenaliOperatorSettingsWorkspace } from "./settings-workspace-guard";

export const WORKSPACE_BRANDING_MODULE_ID = "workspace_branding";

function isAdminOrOwner(auth: TenantAuthContext): boolean {
  return auth.role === "admin" || auth.role === "owner";
}

/**
 * Phase 9.6 module gate — workspace_branding must exist in tenant manifest;
 * mutate requires owner/admin (BR-10).
 */
export async function assertWorkspaceBrandingModuleAccess(
  auth: TenantAuthContext,
  verb: "read" | "mutate"
): Promise<void> {
  await assertDenaliOperatorSettingsWorkspace(auth.tenantId);
  const module = await resolveSettingsModuleForTenant(auth.tenantId, WORKSPACE_BRANDING_MODULE_ID);
  if (module.kind !== "readonly_explorer") {
    throw new SettingsModuleNotSupportedError(WORKSPACE_BRANDING_MODULE_ID);
  }
  if (verb === "mutate" && !isAdminOrOwner(auth)) {
    throw new SettingsMutationForbiddenError();
  }
}
