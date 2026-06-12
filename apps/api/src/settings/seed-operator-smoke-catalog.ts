/**
 * Phase 11.0 — idempotent reference catalog for operator smoke tenant (…000014).
 * @see docs/phase-11/subphases/11.0-smoke-workspace-alignment.md
 */
import type { SettingsResourcesRepository } from "./in-memory-settings-resources.repository";
import type {
  DestinationResource,
  EquipmentResource,
  RegionResource,
  TourThemeResource,
} from "./settings.types";

export const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";

const OPERATOR_SMOKE_EQUIPMENT_ID = "00000000-0000-4000-8000-000000000601";
const OPERATOR_SMOKE_REGION_ID = "00000000-0000-4000-8000-000000000602";
export const OPERATOR_SMOKE_DESTINATION_ID = "00000000-0000-4000-8000-000000000603";
const OPERATOR_SMOKE_THEME_ID = "00000000-0000-4000-8000-000000000604";

const ISO_NOW = "2026-06-11T00:00:00.000Z";

export async function seedOperatorSmokeCatalog(
  repo: SettingsResourcesRepository
): Promise<void> {
  const tenantId = OPERATOR_SMOKE_TENANT_ID;
  const existingEquipment = await repo.listEquipment(tenantId);
  if (existingEquipment.length > 0) {
    return;
  }

  const equipment: EquipmentResource = {
    id: OPERATOR_SMOKE_EQUIPMENT_ID,
    tenantId,
    name: "Smoke Trekking Poles",
    category: "mountain",
    sortOrder: 0,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  };

  const region: RegionResource = {
    id: OPERATOR_SMOKE_REGION_ID,
    tenantId,
    name: "Smoke Alps",
    country: "CH",
    isActive: true,
    sortOrder: 0,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  };

  const destination: DestinationResource = {
    id: OPERATOR_SMOKE_DESTINATION_ID,
    tenantId,
    regionId: OPERATOR_SMOKE_REGION_ID,
    name: "Smoke Summit",
    locationType: "peak",
    altitudeM: 4_200,
    isActive: true,
    sortOrder: 0,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  };

  const theme: TourThemeResource = {
    id: OPERATOR_SMOKE_THEME_ID,
    tenantId,
    name: "Smoke Mountain",
    slug: "smoke-mountain",
    formProfile: "mountain_outdoor",
    isActive: true,
    sortOrder: 0,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  };

  await repo.seedEquipment(equipment);
  await repo.seedRegion(region);
  await repo.seedDestination(destination);
  await repo.seedTourTheme(theme);
}
