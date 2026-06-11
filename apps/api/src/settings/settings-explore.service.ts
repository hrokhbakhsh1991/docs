import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getSettingsAuditRepository } from "./create-settings-audit-repository";
import { resolveSettingsModuleForTenant, SettingsModuleUnknownError } from "./settings-registry";
import { assertDenaliOperatorSettingsWorkspace } from "./settings-workspace-guard";
import type { AuditTrailListResponse } from "./settings.types";

export class SettingsExploreReadOnlyError extends Error {
  readonly code = "SETTINGS_EXPLORE_READ_ONLY" as const;

  constructor() {
    super("SETTINGS_EXPLORE_READ_ONLY");
    this.name = "SettingsExploreReadOnlyError";
  }
}

export class SettingsExploreNotSupportedError extends Error {
  readonly code = "SETTINGS_EXPLORE_NOT_SUPPORTED" as const;

  constructor(readonly moduleId: string) {
    super(`SETTINGS_EXPLORE_NOT_SUPPORTED:${moduleId}`);
    this.name = "SettingsExploreNotSupportedError";
  }
}

async function assertReadonlyExplorerModule(tenantId: string, moduleId: string): Promise<void> {
  const module = await resolveSettingsModuleForTenant(tenantId, moduleId);
  if (module.kind !== "readonly_explorer") {
    throw new SettingsExploreNotSupportedError(moduleId);
  }
}

export async function listSettingsExplore(
  auth: TenantAuthContext,
  moduleId: string
): Promise<AuditTrailListResponse> {
  await assertDenaliOperatorSettingsWorkspace(auth.tenantId);
  await assertReadonlyExplorerModule(auth.tenantId, moduleId);
  if (moduleId !== "audit_trail") {
    throw new SettingsExploreNotSupportedError(moduleId);
  }
  const repo = getSettingsAuditRepository();
  const items = await repo.listByTenant(auth.tenantId);
  return { items, total: items.length };
}

export function assertSettingsExploreMutationForbidden(): never {
  throw new SettingsExploreReadOnlyError();
}

export { SettingsModuleUnknownError };
