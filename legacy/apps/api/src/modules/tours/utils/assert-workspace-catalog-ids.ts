import { BadRequestException } from "@nestjs/common";

import type { WorkspaceSettingsRepositoryPort } from "../../settings-locations/domain/ports/workspace-settings-repository.port";

/**
 * `tenantId` from {@link RequestContextService.resolveEffectiveTenantId} matches
 * `workspace_id` on workspace catalog tables (FK to `tenants.id`).
 */
export async function assertEquipmentIdsBelongToTenant(
  settingsRepository: WorkspaceSettingsRepositoryPort,
  tenantId: string,
  equipmentIds: string[],
): Promise<void> {
  await assertIdsInWorkspaceCatalog(
    settingsRepository.findExistingEquipmentIds.bind(settingsRepository),
    tenantId,
    equipmentIds,
    "INVALID_EQUIPMENT_IDS_FOR_TENANT",
    "Some equipment IDs do not exist or do not belong to the current workspace.",
  );
}

export async function assertTourThemeIdsBelongToTenant(
  settingsRepository: WorkspaceSettingsRepositoryPort,
  tenantId: string,
  themeIds: string[],
): Promise<void> {
  await assertIdsInWorkspaceCatalog(
    settingsRepository.findExistingTourThemeIds.bind(settingsRepository),
    tenantId,
    themeIds,
    "INVALID_TOUR_THEME_IDS_FOR_TENANT",
    "Some tour theme IDs do not exist or do not belong to the current workspace.",
  );
}

export async function assertGuideLanguageIdsBelongToTenant(
  settingsRepository: WorkspaceSettingsRepositoryPort,
  tenantId: string,
  guideLanguageIds: string[],
): Promise<void> {
  await assertIdsInWorkspaceCatalog(
    settingsRepository.findExistingGuideLanguageIds.bind(settingsRepository),
    tenantId,
    guideLanguageIds,
    "INVALID_GUIDE_LANGUAGE_IDS_FOR_TENANT",
    "Some guide language IDs do not exist or do not belong to the current workspace.",
  );
}

async function assertIdsInWorkspaceCatalog(
  loadExistingIds: (workspaceId: string, ids: readonly string[]) => Promise<string[]>,
  tenantId: string,
  ids: string[],
  code: string,
  message: string,
): Promise<void> {
  const unique = [...new Set(ids)].filter((id) => typeof id === "string" && id.trim().length > 0);
  if (unique.length === 0) {
    return;
  }

  const found = await loadExistingIds(tenantId, unique);
  const foundSet = new Set(found);
  const invalidIds = unique.filter((id) => !foundSet.has(id));
  if (invalidIds.length > 0) {
    throw new BadRequestException({
      error: {
        code,
        message,
        invalidIds,
      },
    });
  }
}
