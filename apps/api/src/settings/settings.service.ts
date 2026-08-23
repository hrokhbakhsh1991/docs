import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import { operatorCapabilitySupportsReconciliationTriage } from "@app-tour/workspace-sdk";

import { emitSettingsResourceAudit } from "./settings-audit-emitter";
import { SettingsResourceNotFoundError } from "./in-memory-settings-resources.repository";
import { getSettingsResourcesRepository } from "./create-settings-resources-repository";
import {
  listSettingsModuleMetadataForTenant,
  resolveEquipmentIconKeyValidatorForTenant,
  resolveSettingsModuleForTenant,
  SettingsModuleUnknownError,
} from "./settings-registry";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { enrichSettingsModuleList } from "./workspace-settings-enrichers.generated";
import { parseEquipmentIconKeyInput } from "./parse-equipment-icon-key";
import { normalizeThemeIdsInput } from "./parse-theme-ids";
import { SettingsResourceInvalidError } from "./settings-resource-errors";
import type {
  CreateEquipmentRequest,
  CreateGuideLanguageRequest,
  CreateLocationResourceRequest,
  CreateTourPresetRequest,
  CreateTourThemeRequest,
  EquipmentResource,
  GuideLanguageResource,
  GuideLanguagesListResponse,
  LocationsListResponse,
  PatchEquipmentRequest,
  PatchGuideLanguageRequest,
  PatchLocationResourceRequest,
  PatchTourPresetRequest,
  PatchTourThemeRequest,
  RegionResource,
  DestinationResource,
  SettingsModuleMetadata,
  SettingsModulesListResponse,
  SettingsResourceListResponse,
  TourPresetResource,
  TourPresetsListResponse,
  TourThemeResource,
  TourThemesListResponse,
} from "./settings.types";

export class SettingsMutationForbiddenError extends Error {
  readonly code = "SETTINGS_MUTATION_FORBIDDEN" as const;

  constructor() {
    super("SETTINGS_MUTATION_FORBIDDEN");
    this.name = "SettingsMutationForbiddenError";
  }
}

export class SettingsModuleNotSupportedError extends Error {
  readonly code = "SETTINGS_MODULE_NOT_SUPPORTED" as const;

  constructor(readonly moduleId: string) {
    super(`SETTINGS_MODULE_NOT_SUPPORTED:${moduleId}`);
    this.name = "SettingsModuleNotSupportedError";
  }
}

export { SettingsResourceInvalidError } from "./settings-resource-errors";

const SUPPORTED_REFERENCE_MODULES = new Set([
  "equipment",
  "tour_themes",
  "guide_languages",
  "tour_presets",
  "locations",
]);

function isAdminOrOwner(auth: TenantAuthContext): boolean {
  return auth.role === "admin" || auth.role === "owner";
}

function assertAdminOrOwner(auth: TenantAuthContext): void {
  if (!isAdminOrOwner(auth)) {
    throw new SettingsMutationForbiddenError();
  }
}

function toModuleMetadata(
  modules: Awaited<ReturnType<typeof listSettingsModuleMetadataForTenant>>
): SettingsModuleMetadata[] {
  return modules.map((module) => ({
    id: module.id,
    kind: module.kind,
    route: module.route,
    ability: module.ability,
    nav: module.nav,
  }));
}

const ACCOUNT_PROFILE_MODULE: SettingsModuleMetadata = {
  id: "account_profile",
  kind: "account_preference",
  route: "settings/me",
  ability: "operator.settings.account_profile",
  nav: { group: "account", labelKey: "settings.account_profile" },
};

const RECONCILIATION_TRIAGE_MODULE: SettingsModuleMetadata = {
  id: "reconciliation_triage",
  kind: "readonly_explorer",
  route: "settings/reconciliation-triage",
  ability: "operator.settings.reconciliation_triage",
  nav: { group: "finance_ops", labelKey: "settings.reconciliation_triage" },
};

export async function listSettingsModules(
  auth: TenantAuthContext
): Promise<SettingsModulesListResponse> {
  const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
  const pluginModules = await listSettingsModuleMetadataForTenant(auth.tenantId);
  const items: SettingsModuleMetadata[] = [
    ACCOUNT_PROFILE_MODULE,
    ...toModuleMetadata(pluginModules),
  ];
  if (operatorCapabilitySupportsReconciliationTriage(workspaceType)) {
    items.push(RECONCILIATION_TRIAGE_MODULE);
  }
  return { items };
}

async function assertReferenceDataModule(tenantId: string, moduleId: string): Promise<void> {
  const module = await resolveSettingsModuleForTenant(tenantId, moduleId);
  if (module.kind !== "reference_data") {
    throw new SettingsModuleNotSupportedError(moduleId);
  }
  if (!SUPPORTED_REFERENCE_MODULES.has(moduleId)) {
    throw new SettingsModuleNotSupportedError(moduleId);
  }
}

export async function listSettingsResources(
  auth: TenantAuthContext,
  moduleId: string
): Promise<
  | SettingsResourceListResponse
  | TourThemesListResponse
  | GuideLanguagesListResponse
  | TourPresetsListResponse
  | LocationsListResponse
> {
  await assertReferenceDataModule(auth.tenantId, moduleId);
  const repo = getSettingsResourcesRepository();

  if (moduleId === "equipment") {
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    const raw = await repo.listEquipment(auth.tenantId);
    const items = enrichSettingsModuleList(workspaceType, "equipment", raw);
    return { items, total: items.length };
  }

  if (moduleId === "tour_themes") {
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    const raw = await repo.listTourThemes(auth.tenantId);
    const items = enrichSettingsModuleList(workspaceType, "tour_themes", raw);
    return { items, total: items.length };
  }

  if (moduleId === "guide_languages") {
    const items = await repo.listGuideLanguages(auth.tenantId);
    return { items, total: items.length };
  }

  if (moduleId === "tour_presets") {
    const items = await repo.listTourPresets(auth.tenantId);
    return { items, total: items.length };
  }

  if (moduleId === "locations") {
    const regions = await repo.listRegions(auth.tenantId);
    const destinations = await repo.listDestinations(auth.tenantId);
    return { regions, destinations, total: regions.length + destinations.length };
  }

  throw new SettingsModuleNotSupportedError(moduleId);
}

export async function createSettingsResource(
  auth: TenantAuthContext,
  moduleId: string,
  body:
    | CreateEquipmentRequest
    | CreateTourThemeRequest
    | CreateGuideLanguageRequest
    | CreateTourPresetRequest
    | CreateLocationResourceRequest
): Promise<
  | EquipmentResource
  | TourThemeResource
  | GuideLanguageResource
  | TourPresetResource
  | RegionResource
  | DestinationResource
> {
  assertAdminOrOwner(auth);
  await assertReferenceDataModule(auth.tenantId, moduleId);
  const repo = getSettingsResourcesRepository();

  if (moduleId === "equipment") {
    const equipmentBody = body as CreateEquipmentRequest;
    if (equipmentBody.name.trim().length === 0) {
      throw new SettingsResourceInvalidError();
    }
    let themeIds: string[] = [];
    try {
      themeIds = normalizeThemeIdsInput(equipmentBody.themeIds);
    } catch {
      throw new SettingsResourceInvalidError();
    }
    let iconKey: string | null | undefined;
    try {
      const validateEquipmentIconKey = await resolveEquipmentIconKeyValidatorForTenant(
        auth.tenantId
      );
      iconKey = parseEquipmentIconKeyInput(equipmentBody.iconKey, validateEquipmentIconKey);
    } catch {
      throw new SettingsResourceInvalidError();
    }
    const created = await repo.createEquipment(auth.tenantId, {
      name: equipmentBody.name.trim(),
      ...(equipmentBody.category !== undefined && equipmentBody.category.trim().length > 0
        ? { category: equipmentBody.category.trim() }
        : {}),
      ...(iconKey !== undefined ? { iconKey } : {}),
      themeIds,
    });
    await emitSettingsResourceAudit(
      auth,
      "create",
      moduleId,
      created.id,
      `Created equipment: ${created.name}`
    );
    return created;
  }

  if (moduleId === "tour_themes") {
    const themeBody = body as CreateTourThemeRequest;
    if (themeBody.name.trim().length === 0) {
      throw new SettingsResourceInvalidError();
    }
    const created = await repo.createTourTheme(auth.tenantId, {
      name: themeBody.name.trim(),
      ...(themeBody.slug !== undefined ? { slug: themeBody.slug.trim() } : {}),
      ...(themeBody.isActive !== undefined ? { isActive: themeBody.isActive } : {}),
    });
    await emitSettingsResourceAudit(
      auth,
      "create",
      moduleId,
      created.id,
      `Created tour theme: ${created.name}`
    );
    return created;
  }

  if (moduleId === "guide_languages") {
    const languageBody = body as CreateGuideLanguageRequest;
    if (languageBody.name.trim().length === 0) {
      throw new SettingsResourceInvalidError();
    }
    const created = await repo.createGuideLanguage(auth.tenantId, {
      name: languageBody.name.trim(),
      ...(languageBody.slug !== undefined ? { slug: languageBody.slug.trim() } : {}),
      ...(languageBody.isActive !== undefined ? { isActive: languageBody.isActive } : {}),
    });
    await emitSettingsResourceAudit(
      auth,
      "create",
      moduleId,
      created.id,
      `Created guide language: ${created.name}`
    );
    return created;
  }

  if (moduleId === "tour_presets") {
    const presetBody = body as CreateTourPresetRequest;
    if (presetBody.name.trim().length === 0) {
      throw new SettingsResourceInvalidError();
    }
    const created = await repo.createTourPreset(auth.tenantId, {
      name: presetBody.name.trim(),
      ...(presetBody.description !== undefined
        ? { description: presetBody.description.trim() }
        : {}),
      ...(presetBody.themeId !== undefined ? { themeId: presetBody.themeId.trim() } : {}),
      ...(presetBody.isActive !== undefined ? { isActive: presetBody.isActive } : {}),
    });
    await emitSettingsResourceAudit(
      auth,
      "create",
      moduleId,
      created.id,
      `Created tour preset: ${created.name}`
    );
    return created;
  }

  if (moduleId !== "locations") {
    throw new SettingsResourceInvalidError();
  }

  const locationBody = body as CreateLocationResourceRequest;
  if (locationBody.entity === "region") {
    if (locationBody.name.trim().length === 0) {
      throw new SettingsResourceInvalidError();
    }
    const created = await repo.createRegion(auth.tenantId, {
      name: locationBody.name.trim(),
      ...(locationBody.country !== undefined ? { country: locationBody.country.trim() } : {}),
    });
    await emitSettingsResourceAudit(
      auth,
      "create",
      moduleId,
      created.id,
      `Created region: ${created.name}`,
      "region"
    );
    return created;
  }

  if (locationBody.entity === "destination") {
    if (locationBody.name.trim().length === 0 || locationBody.regionId.trim().length === 0) {
      throw new SettingsResourceInvalidError();
    }
    const created = await repo.createDestination(auth.tenantId, {
      regionId: locationBody.regionId.trim(),
      name: locationBody.name.trim(),
      ...(locationBody.locationType !== undefined
        ? { locationType: locationBody.locationType.trim() }
        : {}),
      ...(locationBody.altitudeM !== undefined ? { altitudeM: locationBody.altitudeM } : {}),
      ...(locationBody.typicalTrailDistanceKm !== undefined
        ? { typicalTrailDistanceKm: locationBody.typicalTrailDistanceKm }
        : {}),
    });
    await emitSettingsResourceAudit(
      auth,
      "create",
      moduleId,
      created.id,
      `Created destination: ${created.name}`,
      "destination"
    );
    return created;
  }

  throw new SettingsResourceInvalidError();
}

export async function patchSettingsResource(
  auth: TenantAuthContext,
  moduleId: string,
  itemId: string,
  body:
    | PatchEquipmentRequest
    | PatchTourThemeRequest
    | PatchGuideLanguageRequest
    | PatchTourPresetRequest
    | PatchLocationResourceRequest
): Promise<
  | EquipmentResource
  | TourThemeResource
  | GuideLanguageResource
  | TourPresetResource
  | RegionResource
  | DestinationResource
> {
  assertAdminOrOwner(auth);
  await assertReferenceDataModule(auth.tenantId, moduleId);
  const repo = getSettingsResourcesRepository();

  if (moduleId === "equipment") {
    const equipmentBody = body as PatchEquipmentRequest;
    let themeIds: string[] | undefined;
    if (equipmentBody.themeIds !== undefined) {
      try {
        themeIds = normalizeThemeIdsInput(equipmentBody.themeIds);
      } catch {
        throw new SettingsResourceInvalidError();
      }
    }
    let iconKey: string | null | undefined;
    try {
      const validateEquipmentIconKey = await resolveEquipmentIconKeyValidatorForTenant(
        auth.tenantId
      );
      iconKey = parseEquipmentIconKeyInput(equipmentBody.iconKey, validateEquipmentIconKey);
    } catch {
      throw new SettingsResourceInvalidError();
    }
    const updated = await repo.patchEquipment(auth.tenantId, itemId, {
      ...(equipmentBody.name !== undefined ? { name: equipmentBody.name.trim() } : {}),
      ...(equipmentBody.category !== undefined ? { category: equipmentBody.category } : {}),
      ...(iconKey !== undefined ? { iconKey } : {}),
      ...(themeIds !== undefined ? { themeIds } : {}),
    });
    await emitSettingsResourceAudit(
      auth,
      "patch",
      moduleId,
      updated.id,
      `Updated equipment: ${updated.name}`
    );
    return updated;
  }

  if (moduleId === "tour_themes") {
    const themeBody = body as PatchTourThemeRequest;
    const updated = await repo.patchTourTheme(auth.tenantId, itemId, {
      ...(themeBody.name !== undefined ? { name: themeBody.name.trim() } : {}),
      ...(themeBody.slug !== undefined ? { slug: themeBody.slug.trim() } : {}),
      ...(themeBody.isActive !== undefined ? { isActive: themeBody.isActive } : {}),
    });
    await emitSettingsResourceAudit(
      auth,
      "patch",
      moduleId,
      updated.id,
      `Updated tour theme: ${updated.name}`
    );
    return updated;
  }

  if (moduleId === "guide_languages") {
    const languageBody = body as PatchGuideLanguageRequest;
    const updated = await repo.patchGuideLanguage(auth.tenantId, itemId, {
      ...(languageBody.name !== undefined ? { name: languageBody.name.trim() } : {}),
      ...(languageBody.slug !== undefined ? { slug: languageBody.slug.trim() } : {}),
      ...(languageBody.isActive !== undefined ? { isActive: languageBody.isActive } : {}),
    });
    await emitSettingsResourceAudit(
      auth,
      "patch",
      moduleId,
      updated.id,
      `Updated guide language: ${updated.name}`
    );
    return updated;
  }

  if (moduleId === "tour_presets") {
    const presetBody = body as PatchTourPresetRequest;
    const updated = await repo.patchTourPreset(auth.tenantId, itemId, {
      ...(presetBody.name !== undefined ? { name: presetBody.name.trim() } : {}),
      ...(presetBody.description !== undefined ? { description: presetBody.description } : {}),
      ...(presetBody.themeId !== undefined ? { themeId: presetBody.themeId } : {}),
      ...(presetBody.isActive !== undefined ? { isActive: presetBody.isActive } : {}),
    });
    await emitSettingsResourceAudit(
      auth,
      "patch",
      moduleId,
      updated.id,
      `Updated tour preset: ${updated.name}`
    );
    return updated;
  }

  if (moduleId !== "locations") {
    throw new SettingsModuleNotSupportedError(moduleId);
  }

  const locationBody = body as PatchLocationResourceRequest;
  const updated = await repo.patchLocationResource(auth.tenantId, itemId, {
    ...(locationBody.name !== undefined ? { name: locationBody.name.trim() } : {}),
    ...(locationBody.country !== undefined ? { country: locationBody.country } : {}),
    ...(locationBody.regionId !== undefined ? { regionId: locationBody.regionId.trim() } : {}),
    ...(locationBody.locationType !== undefined ? { locationType: locationBody.locationType } : {}),
    ...(locationBody.altitudeM !== undefined ? { altitudeM: locationBody.altitudeM } : {}),
    ...(locationBody.typicalTrailDistanceKm !== undefined
      ? { typicalTrailDistanceKm: locationBody.typicalTrailDistanceKm }
      : {}),
    ...(locationBody.isActive !== undefined ? { isActive: locationBody.isActive } : {}),
  });
  const resourceType = "regionId" in updated ? "destination" : "region";
  await emitSettingsResourceAudit(
    auth,
    "patch",
    moduleId,
    updated.id,
    `Updated ${resourceType}: ${updated.name}`,
    resourceType
  );
  return updated;
}

export async function deleteSettingsResource(
  auth: TenantAuthContext,
  moduleId: string,
  itemId: string
): Promise<void> {
  assertAdminOrOwner(auth);
  await assertReferenceDataModule(auth.tenantId, moduleId);
  const repo = getSettingsResourcesRepository();

  if (moduleId === "equipment") {
    await repo.deleteEquipment(auth.tenantId, itemId);
    await emitSettingsResourceAudit(
      auth,
      "delete",
      moduleId,
      itemId,
      `Deleted equipment ${itemId}`
    );
    return;
  }

  if (moduleId === "tour_themes") {
    await repo.deleteTourTheme(auth.tenantId, itemId);
    await emitSettingsResourceAudit(
      auth,
      "delete",
      moduleId,
      itemId,
      `Deleted tour theme ${itemId}`
    );
    return;
  }

  if (moduleId === "guide_languages") {
    await repo.deleteGuideLanguage(auth.tenantId, itemId);
    await emitSettingsResourceAudit(
      auth,
      "delete",
      moduleId,
      itemId,
      `Deleted guide language ${itemId}`
    );
    return;
  }

  if (moduleId === "tour_presets") {
    await repo.deleteTourPreset(auth.tenantId, itemId);
    await emitSettingsResourceAudit(
      auth,
      "delete",
      moduleId,
      itemId,
      `Deleted tour preset ${itemId}`
    );
    return;
  }

  if (moduleId === "locations") {
    await repo.deleteLocationResource(auth.tenantId, itemId);
    await emitSettingsResourceAudit(
      auth,
      "delete",
      moduleId,
      itemId,
      `Deleted location resource ${itemId}`
    );
    return;
  }

  throw new SettingsModuleNotSupportedError(moduleId);
}

export { SettingsModuleUnknownError, SettingsResourceNotFoundError };
