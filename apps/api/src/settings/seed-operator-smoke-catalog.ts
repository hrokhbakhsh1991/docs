/**
 * Phase 11.0 — idempotent reference catalog for operator smoke tenant (…000014).
 * Denali dev tenant (…000003) uses a separate id namespace — global PK on settings rows.
 * @see docs/phase-11/subphases/11.0-smoke-workspace-alignment.md
 */
import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

export { DENALI_SMOKE_TENANT_ID };

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
  destinationDamavand: "00000000-0000-4000-8000-000000000705",
  destinationAlamKuh: "00000000-0000-4000-8000-000000000706",
  theme: "00000000-0000-4000-8000-000000000704",
} as const;

/** Minimum active destinations for wizard destination combobox smoke (TW-05). */
export const DENALI_DEV_SMOKE_MIN_DESTINATIONS = 3;

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

function buildDenaliDevExtraDestinations(
  tenantId: string,
  regionId: string
): readonly DestinationResource[] {
  const ids = DENALI_DEV_SMOKE_CATALOG_IDS;
  return [
    {
      id: ids.destination,
      tenantId,
      regionId,
      name: "توچال",
      locationType: "peak",
      altitudeM: 3_962,
      typicalTrailDistanceKm: null,
      isActive: true,
      sortOrder: 0,
      createdAt: ISO_NOW,
      updatedAt: ISO_NOW,
    },
    {
      id: ids.destinationDamavand,
      tenantId,
      regionId,
      name: "دماوند",
      locationType: "peak",
      altitudeM: 5_610,
      typicalTrailDistanceKm: null,
      isActive: true,
      sortOrder: 1,
      createdAt: ISO_NOW,
      updatedAt: ISO_NOW,
    },
    {
      id: ids.destinationAlamKuh,
      tenantId,
      regionId,
      name: "علم‌کوه",
      locationType: "peak",
      altitudeM: 4_850,
      typicalTrailDistanceKm: null,
      isActive: true,
      sortOrder: 2,
      createdAt: ISO_NOW,
      updatedAt: ISO_NOW,
    },
  ];
}

async function ensureDenaliDevSmokeDestinations(
  repo: SettingsResourcesRepository,
  tenantId: string
): Promise<void> {
  if (tenantId !== DENALI_SMOKE_TENANT_ID) {
    return;
  }

  const ids = DENALI_DEV_SMOKE_CATALOG_IDS;
  const existingRegions = await repo.listRegions(tenantId);
  if (existingRegions.length === 0) {
    const region: RegionResource = {
      id: ids.region,
      tenantId,
      name: "تهران",
      country: "IR",
      isActive: true,
      sortOrder: 0,
      createdAt: ISO_NOW,
      updatedAt: ISO_NOW,
    };
    await repo.seedRegion(region);
  }

  const regionId = existingRegions[0]?.id ?? ids.region;
  const existingById = new Map(
    (await repo.listDestinations(tenantId)).map((destination) => [destination.id, destination])
  );

  for (const destination of buildDenaliDevExtraDestinations(tenantId, regionId)) {
    if (!existingById.has(destination.id)) {
      await repo.seedDestination(destination);
    }
  }
}

export async function seedOperatorSmokeCatalog(
  repo: SettingsResourcesRepository,
  options?: { readonly tenantId?: string }
): Promise<void> {
  const tenantId = options?.tenantId ?? OPERATOR_SMOKE_TENANT_ID;
  const existingEquipment = await repo.listEquipment(tenantId);
  if (existingEquipment.length > 0) {
    await ensureDenaliDevSmokeDestinations(repo, tenantId);
    return;
  }

  const ids = resolveSmokeCatalogIds(tenantId);

  const equipment: EquipmentResource = {
    id: ids.equipment,
    tenantId,
    name: "Smoke Trekking Poles",
    category: "mountain",
    iconKey: "trekking_poles",
    themeIds: [ids.theme],
    sortOrder: 0,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  };

  const region: RegionResource = {
    id: ids.region,
    tenantId,
    name: tenantId === DENALI_SMOKE_TENANT_ID ? "تهران" : "Smoke Alps",
    country: tenantId === DENALI_SMOKE_TENANT_ID ? "IR" : "CH",
    isActive: true,
    sortOrder: 0,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  };

  const destinations =
    tenantId === DENALI_SMOKE_TENANT_ID
      ? buildDenaliDevExtraDestinations(tenantId, ids.region)
      : [
          {
            id: ids.destination,
            tenantId,
            regionId: ids.region,
            name: "Smoke Summit",
            locationType: "peak" as const,
            altitudeM: 4_200,
            typicalTrailDistanceKm: null,
            isActive: true,
            sortOrder: 0,
            createdAt: ISO_NOW,
            updatedAt: ISO_NOW,
          },
        ];

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
  for (const destination of destinations) {
    await repo.seedDestination(destination);
  }
  await repo.seedTourTheme(theme);
}
