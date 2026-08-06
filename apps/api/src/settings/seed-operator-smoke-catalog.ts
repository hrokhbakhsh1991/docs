/**
 * Phase 11.0 — idempotent reference catalog for operator smoke tenant (…000014).
 * Denali club tenant (…000003) uses a separate id namespace — global PK on settings rows.
 * Denali club FA admin surfaces use Persian display names for equipment/theme (ED-LBL-CATALOG-01).
 * @see docs/phase-11/subphases/11.0-smoke-workspace-alignment.md
 * @see docs/workspaces/denali/operator-tour-edit-remediation.mdoc
 */
import { DENALI_SMOKE_TENANT_ID } from "./resolve-workspace-dev-smoke-tenant";

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

/** Operator SMK strings — keep English for e2e stability on tenant …014. */
const OPERATOR_SMOKE_EQUIPMENT_NAME = "Smoke Trekking Poles";
const OPERATOR_SMOKE_THEME_NAME = "Smoke Mountain";
const OPERATOR_SMOKE_THEME_SLUG = "smoke-mountain";

/** Denali club FA admin — readable Persian labels in wizard gear + Settings equipment. */
const DENALI_CLUB_EQUIPMENT_NAME = "عصای کوهنوردی";
const DENALI_CLUB_THEME_NAME = "کوهستان";
/** Keep stable slug across renames so existing themeId FKs stay valid. */
const DENALI_CLUB_THEME_SLUG = "smoke-mountain";

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

function buildSmokeEquipment(tenantId: string): EquipmentResource {
  const ids = resolveSmokeCatalogIds(tenantId);
  const isDenaliClub = tenantId === DENALI_SMOKE_TENANT_ID;
  return {
    id: ids.equipment,
    tenantId,
    name: isDenaliClub ? DENALI_CLUB_EQUIPMENT_NAME : OPERATOR_SMOKE_EQUIPMENT_NAME,
    category: "mountain",
    iconKey: "trekking_poles",
    themeIds: [ids.theme],
    sortOrder: 0,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  };
}

function buildSmokeTourTheme(tenantId: string): TourThemeResource {
  const ids = resolveSmokeCatalogIds(tenantId);
  const isDenaliClub = tenantId === DENALI_SMOKE_TENANT_ID;
  return {
    id: ids.theme,
    tenantId,
    name: isDenaliClub ? DENALI_CLUB_THEME_NAME : OPERATOR_SMOKE_THEME_NAME,
    slug: isDenaliClub ? DENALI_CLUB_THEME_SLUG : OPERATOR_SMOKE_THEME_SLUG,
    formProfile: "mountain_outdoor",
    isActive: true,
    sortOrder: 0,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  };
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

/**
 * ED-LBL-CATALOG-01 — re-upsert Denali club equipment/theme display names without wiping
 * operator-created catalog rows. Safe on every bootstrap because seed* upserts by fixed id.
 */
async function ensureDenaliDevSmokeCatalogDisplayNames(
  repo: SettingsResourcesRepository,
  tenantId: string
): Promise<void> {
  if (tenantId !== DENALI_SMOKE_TENANT_ID) {
    return;
  }
  await repo.seedEquipment(buildSmokeEquipment(tenantId));
  await repo.seedTourTheme(buildSmokeTourTheme(tenantId));
}

export async function seedOperatorSmokeCatalog(
  repo: SettingsResourcesRepository,
  options?: { readonly tenantId?: string }
): Promise<void> {
  const tenantId = options?.tenantId ?? OPERATOR_SMOKE_TENANT_ID;
  const existingEquipment = await repo.listEquipment(tenantId);
  if (existingEquipment.length > 0) {
    await ensureDenaliDevSmokeDestinations(repo, tenantId);
    await ensureDenaliDevSmokeCatalogDisplayNames(repo, tenantId);
    return;
  }

  const ids = resolveSmokeCatalogIds(tenantId);
  const equipment = buildSmokeEquipment(tenantId);

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

  const theme = buildSmokeTourTheme(tenantId);

  await repo.seedEquipment(equipment);
  await repo.seedRegion(region);
  for (const destination of destinations) {
    await repo.seedDestination(destination);
  }
  await repo.seedTourTheme(theme);
}
