import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { resolveSettingsModuleForTenant } from "./settings-registry";
import { SettingsModuleNotSupportedError, SettingsMutationForbiddenError } from "./settings.service";
import { assertDenaliOperatorSettingsWorkspace } from "./settings-workspace-guard";

export const EXPOSURE_MODULE_ID = "exposure";

function isAdminOrOwner(auth: TenantAuthContext): boolean {
  return auth.role === "admin" || auth.role === "owner";
}

/**
 * Phase 9.4 module gate — exposure must exist in tenant manifest;
 * mutate requires owner/admin.
 */
export async function assertWorkspaceExposureModuleAccess(
  auth: TenantAuthContext,
  verb: "read" | "mutate",
): Promise<void> {
  await assertDenaliOperatorSettingsWorkspace(auth.tenantId);
  const module = await resolveSettingsModuleForTenant(auth.tenantId, EXPOSURE_MODULE_ID);
  if (module.kind !== "readonly_explorer") {
    throw new SettingsModuleNotSupportedError(EXPOSURE_MODULE_ID);
  }
  if (verb === "mutate" && !isAdminOrOwner(auth)) {
    throw new SettingsMutationForbiddenError();
  }
}
