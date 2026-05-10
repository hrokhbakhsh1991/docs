import { BadRequestException } from "@nestjs/common";
import { type FindOptionsWhere, type Repository, In } from "typeorm";

import { WorkspaceEquipmentItemEntity } from "../../settings-locations/entities/workspace-equipment-item.entity";
import { WorkspaceGuideLanguageEntity } from "../../settings-locations/entities/workspace-guide-language.entity";
import { WorkspaceTourThemeEntity } from "../../settings-locations/entities/workspace-tour-theme.entity";

/**
 * `tenantId` from {@link RequestContextService.resolveEffectiveTenantId} matches
 * `workspace_id` on workspace catalog tables (FK to `tenants.id`).
 */
export async function assertEquipmentIdsBelongToTenant(
  equipmentRepository: Repository<WorkspaceEquipmentItemEntity>,
  tenantId: string,
  equipmentIds: string[],
): Promise<void> {
  await assertIdsInWorkspaceCatalog(
    equipmentRepository,
    tenantId,
    equipmentIds,
    "INVALID_EQUIPMENT_IDS_FOR_TENANT",
    "Some equipment IDs do not exist or do not belong to the current workspace.",
  );
}

export async function assertTourThemeIdsBelongToTenant(
  tourThemesRepository: Repository<WorkspaceTourThemeEntity>,
  tenantId: string,
  themeIds: string[],
): Promise<void> {
  await assertIdsInWorkspaceCatalog(
    tourThemesRepository,
    tenantId,
    themeIds,
    "INVALID_TOUR_THEME_IDS_FOR_TENANT",
    "Some tour theme IDs do not exist or do not belong to the current workspace.",
  );
}

export async function assertGuideLanguageIdsBelongToTenant(
  guideLanguagesRepository: Repository<WorkspaceGuideLanguageEntity>,
  tenantId: string,
  guideLanguageIds: string[],
): Promise<void> {
  await assertIdsInWorkspaceCatalog(
    guideLanguagesRepository,
    tenantId,
    guideLanguageIds,
    "INVALID_GUIDE_LANGUAGE_IDS_FOR_TENANT",
    "Some guide language IDs do not exist or do not belong to the current workspace.",
  );
}

type CatalogEntity =
  | WorkspaceEquipmentItemEntity
  | WorkspaceTourThemeEntity
  | WorkspaceGuideLanguageEntity;

async function assertIdsInWorkspaceCatalog<T extends CatalogEntity>(
  repository: Repository<T>,
  tenantId: string,
  ids: string[],
  code: string,
  message: string,
): Promise<void> {
  const unique = [...new Set(ids)].filter((id) => typeof id === "string" && id.trim().length > 0);
  if (unique.length === 0) {
    return;
  }

  const rows = await repository.find({
    where: {
      id: In(unique),
      workspaceId: tenantId,
    } as FindOptionsWhere<T>,
    select: { id: true } as never,
  });

  const found = new Set(rows.map((r) => r.id));
  const invalidIds = unique.filter((id) => !found.has(id));
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
