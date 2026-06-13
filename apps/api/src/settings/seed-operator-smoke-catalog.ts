/**
 * Phase 11.0 — idempotent reference catalog for operator smoke tenant (…000014).
 * Denali dev tenant (…000003) uses a separate id namespace — global PK on settings rows.
 * @see docs/phase-11/subphases/11.0-smoke-workspace-alignment.md
 */
import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import type { SettingsResourcesRepository } from "./in-memory-settings-resources.repository";
import type {
  DestinationResource,
  EquipmentResource,
  RegionResource,
  TourThemeResource,
} from "./settings.types";

export const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";

export const OPERATOR_SMOKE_CATALOG_IDS = {
  equipment: "00000000-0000-4000-8000-000000000601",
  region: "00000000-0000-4000-8000-000000000602",
  destination: "00000000-0000-4000-8000-000000000603",
  theme: "00000000-0000-4000-8000-000000000604",
} as const;

export const DENALI_DEV_SMOKE_CATALOG_IDS = {
  equipment: "00000000-0000-4000-8000-000000000701",
  region: "00000000-0000-4000-8000-000000000702",
  destination: "00000000-0000-4000-8000-000000000703",
  theme: "00000000-0000-4000-8000-000000000704",
} as const;

/** @deprecated use OPERATOR_SMOKE_CATALOG_IDS.destination */
export const OPERATOR_SMOKE_DESTINATION_ID = OPERATOR_SMOKE_CATALOG_IDS.destination;

const ISO_NOW = "2026-06-11T00:00:00.000Z";

function resolveSmokeCatalogIds(
  tenantId: string
): typeof OPERATOR_SMOKE_CATALOG_IDS | typeof DENALI_DEV_SMOKE_CATALOG_IDS {
  return tenantId === DENALI_SMOKE_TENANT_ID
    ? DENALI_DEV_SMOKE_CATALOG_IDS
    : OPERATOR_SMOKE_CATALOG_IDS;
}

export async function seedOperatorSmokeCatalog(
  repo: SettingsResourcesRepository,
  options?: { readonly tenantId?: string }
): Promise<void> {
  const tenantId = options?.tenantId ?? OPERATOR_SMOKE_TENANT_ID;
  const existingEquipment = await repo.listEquipment(tenantId);
  if (existingEquipment.length > 0) {
    return;
  }

  const ids = resolveSmokeCatalogIds(tenantId);

  const equipment: EquipmentResource = {
    id: ids.equipment,
    tenantId,
    name: "Smoke Trekking Poles",
    category: "mountain",
    themeIds: [ids.theme],
    sortOrder: 0,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  };

  const region: RegionResource = {
    id: ids.region,
    tenantId,
    name: "Smoke Alps",
    country: "CH",
    isActive: true,
    sortOrder: 0,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  };

  const destination: DestinationResource = {
    id: ids.destination,
    tenantId,
    regionId: ids.region,
    name: "Smoke Summit",
    locationType: "peak",
    altitudeM: 4_200,
    isActive: true,
    sortOrder: 0,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  };

  const theme: TourThemeResource = {
    id: ids.theme,
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
