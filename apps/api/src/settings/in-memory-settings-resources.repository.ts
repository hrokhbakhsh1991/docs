import { randomUUID } from "node:crypto";

import { slugifyName, uniqueCatalogSlug } from './settings-catalog-slug';

import type {
  DestinationResource,
  EquipmentResource,
  GuideLanguageResource,
  RegionResource,
  TourPresetResource,
  TourThemeResource,
} from "./settings.types";

type ResourceKey = `${string}:${string}`;

let equipmentStore = new Map<ResourceKey, EquipmentResource>();
let tourThemeStore = new Map<ResourceKey, TourThemeResource>();
let guideLanguageStore = new Map<ResourceKey, GuideLanguageResource>();
let tourPresetStore = new Map<ResourceKey, TourPresetResource>();
let regionStore = new Map<ResourceKey, RegionResource>();
let destinationStore = new Map<ResourceKey, DestinationResource>();

function resourceKey(tenantId: string, itemId: string): ResourceKey {
  return `${tenantId}:${itemId}`;
}

function tenantSlugs(
  store: Map<ResourceKey, { tenantId: string; slug: string }>,
  tenantId: string
): string[] {
  return [...store.values()].filter((row) => row.tenantId === tenantId).map((row) => row.slug);
}

export function resetSettingsResourcesRepositoryForTests(): void {
  equipmentStore = new Map();
  tourThemeStore = new Map();
  guideLanguageStore = new Map();
  tourPresetStore = new Map();
  regionStore = new Map();
  destinationStore = new Map();
}

export interface SettingsResourcesRepository {
  listEquipment(tenantId: string): Promise<EquipmentResource[]>;
  getEquipment(tenantId: string, itemId: string): Promise<EquipmentResource | null>;
  createEquipment(
    tenantId: string,
    input: { name: string; category?: string; themeIds?: readonly string[] }
  ): Promise<EquipmentResource>;
  patchEquipment(
    tenantId: string,
    itemId: string,
    input: { name?: string; category?: string | null; themeIds?: readonly string[] }
  ): Promise<EquipmentResource>;
  deleteEquipment(tenantId: string, itemId: string): Promise<void>;
  seedEquipment(record: EquipmentResource): Promise<void>;
  listTourThemes(tenantId: string): Promise<TourThemeResource[]>;
  getTourTheme(tenantId: string, themeId: string): Promise<TourThemeResource | null>;
  createTourTheme(tenantId: string, input: { name: string; slug?: string; isActive?: boolean }): Promise<TourThemeResource>;
  patchTourTheme(tenantId: string, itemId: string, input: { name?: string; slug?: string; isActive?: boolean }): Promise<TourThemeResource>;
  deleteTourTheme(tenantId: string, itemId: string): Promise<void>;
  seedTourTheme(record: TourThemeResource): Promise<void>;
  listGuideLanguages(tenantId: string): Promise<GuideLanguageResource[]>;
  createGuideLanguage(tenantId: string, input: { name: string; slug?: string; isActive?: boolean }): Promise<GuideLanguageResource>;
  patchGuideLanguage(tenantId: string, itemId: string, input: { name?: string; slug?: string; isActive?: boolean }): Promise<GuideLanguageResource>;
  deleteGuideLanguage(tenantId: string, itemId: string): Promise<void>;
  seedGuideLanguage(record: GuideLanguageResource): Promise<void>;
  listTourPresets(tenantId: string): Promise<TourPresetResource[]>;
  createTourPreset(tenantId: string, input: { name: string; description?: string; themeId?: string; isActive?: boolean }): Promise<TourPresetResource>;
  patchTourPreset(tenantId: string, itemId: string, input: { name?: string; description?: string | null; themeId?: string | null; isActive?: boolean }): Promise<TourPresetResource>;
  deleteTourPreset(tenantId: string, itemId: string): Promise<void>;
  seedTourPreset(record: TourPresetResource): Promise<void>;
  listRegions(tenantId: string): Promise<RegionResource[]>;
  listDestinations(tenantId: string): Promise<DestinationResource[]>;
  getRegion(tenantId: string, regionId: string): Promise<RegionResource | null>;
  createRegion(tenantId: string, input: { name: string; country?: string }): Promise<RegionResource>;
  createDestination(tenantId: string, input: { regionId: string; name: string; locationType?: string }): Promise<DestinationResource>;
  patchRegion(tenantId: string, itemId: string, input: { name?: string; country?: string | null; isActive?: boolean }): Promise<RegionResource>;
  patchDestination(tenantId: string, itemId: string, input: { name?: string; regionId?: string; locationType?: string | null; isActive?: boolean }): Promise<DestinationResource>;
  deleteRegion(tenantId: string, itemId: string): Promise<void>;
  deleteDestination(tenantId: string, itemId: string): Promise<void>;
  patchLocationResource(tenantId: string, itemId: string, input: { name?: string; country?: string | null; regionId?: string; locationType?: string | null; isActive?: boolean }): Promise<RegionResource | DestinationResource>;
  deleteLocationResource(tenantId: string, itemId: string): Promise<void>;
  seedRegion(record: RegionResource): Promise<void>;
  seedDestination(record: DestinationResource): Promise<void>;
}

export class InMemorySettingsResourcesRepository implements SettingsResourcesRepository {
  async listEquipment(tenantId: string): Promise<EquipmentResource[]> {
    return [...equipmentStore.values()]
      .filter((row) => row.tenantId === tenantId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async getEquipment(tenantId: string, itemId: string): Promise<EquipmentResource | null> {
    const row = equipmentStore.get(resourceKey(tenantId, itemId));
    return row === undefined ? null : { ...row };
  }

  async createEquipment(
    tenantId: string,
    input: { name: string; category?: string; themeIds?: readonly string[] }
  ): Promise<EquipmentResource> {
    const now = new Date().toISOString();
    const existing = await this.listEquipment(tenantId);
    const record: EquipmentResource = {
      id: randomUUID(),
      tenantId,
      name: input.name,
      category: input.category ?? null,
      themeIds: input.themeIds ?? [],
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now,
    };
    equipmentStore.set(resourceKey(tenantId, record.id), record);
    return { ...record };
  }

  async patchEquipment(
    tenantId: string,
    itemId: string,
    input: { name?: string; category?: string | null; themeIds?: readonly string[] }
  ): Promise<EquipmentResource> {
    const current = equipmentStore.get(resourceKey(tenantId, itemId));
    if (current === undefined) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    const updated: EquipmentResource = {
      ...current,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.themeIds !== undefined ? { themeIds: [...input.themeIds] } : {}),
      updatedAt: new Date().toISOString(),
    };
    equipmentStore.set(resourceKey(tenantId, itemId), updated);
    return { ...updated };
  }

  async deleteEquipment(tenantId: string, itemId: string): Promise<void> {
    const deleted = equipmentStore.delete(resourceKey(tenantId, itemId));
    if (!deleted) {
      throw new SettingsResourceNotFoundError(itemId);
    }
  }

  async seedEquipment(record: EquipmentResource): Promise<void> {
    equipmentStore.set(resourceKey(record.tenantId, record.id), { ...record });
  }

  async listTourThemes(tenantId: string): Promise<TourThemeResource[]> {
    return [...tourThemeStore.values()]
      .filter((row) => row.tenantId === tenantId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async createTourTheme(
    tenantId: string,
    input: { name: string; slug?: string; isActive?: boolean }
  ): TourThemeResource {
    const now = new Date().toISOString();
    const existing = await this.listTourThemes(tenantId);
    const baseSlug = slugifyName(input.slug ?? input.name);
    const record: TourThemeResource = {
      id: randomUUID(),
      tenantId,
      name: input.name,
      slug: uniqueCatalogSlug(tenantSlugs(tourThemeStore, tenantId), baseSlug, "theme"),
      formProfile: null,
      isActive: input.isActive ?? true,
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now,
    };
    tourThemeStore.set(resourceKey(tenantId, record.id), record);
    return { ...record };
  }

  async patchTourTheme(
    tenantId: string,
    itemId: string,
    input: { name?: string; slug?: string; isActive?: boolean }
  ): Promise<TourThemeResource> {
    const current = tourThemeStore.get(resourceKey(tenantId, itemId));
    if (current === undefined) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    let nextSlug = current.slug;
    if (input.slug !== undefined) {
      const candidate = slugifyName(input.slug);
      const conflict = [...tourThemeStore.values()].some(
        (row) => row.tenantId === tenantId && row.slug === candidate && row.id !== itemId
      );
      nextSlug = conflict ? uniqueCatalogSlug(tenantSlugs(tourThemeStore, tenantId), candidate, "theme") : candidate;
    }
    const updated: TourThemeResource = {
      ...current,
      ...(input.name !== undefined ? { name: input.name } : {}),
      slug: nextSlug,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date().toISOString(),
    };
    tourThemeStore.set(resourceKey(tenantId, itemId), updated);
    return { ...updated };
  }

  async deleteTourTheme(tenantId: string, itemId: string): Promise<void> {
    const deleted = tourThemeStore.delete(resourceKey(tenantId, itemId));
    if (!deleted) {
      throw new SettingsResourceNotFoundError(itemId);
    }
  }

  async seedTourTheme(record: TourThemeResource): Promise<void> {
    tourThemeStore.set(resourceKey(record.tenantId, record.id), { ...record });
  }

  async listGuideLanguages(tenantId: string): Promise<GuideLanguageResource[]> {
    return [...guideLanguageStore.values()]
      .filter((row) => row.tenantId === tenantId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async createGuideLanguage(
    tenantId: string,
    input: { name: string; slug?: string; isActive?: boolean }
  ): GuideLanguageResource {
    const now = new Date().toISOString();
    const existing = await this.listGuideLanguages(tenantId);
    const baseSlug = slugifyName(input.slug ?? input.name);
    const record: GuideLanguageResource = {
      id: randomUUID(),
      tenantId,
      name: input.name,
      slug: uniqueCatalogSlug(tenantSlugs(guideLanguageStore, tenantId), baseSlug, "language"),
      isActive: input.isActive ?? true,
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now,
    };
    guideLanguageStore.set(resourceKey(tenantId, record.id), record);
    return { ...record };
  }

  async patchGuideLanguage(
    tenantId: string,
    itemId: string,
    input: { name?: string; slug?: string; isActive?: boolean }
  ): Promise<GuideLanguageResource> {
    const current = guideLanguageStore.get(resourceKey(tenantId, itemId));
    if (current === undefined) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    let nextSlug = current.slug;
    if (input.slug !== undefined) {
      const candidate = slugifyName(input.slug);
      const conflict = [...guideLanguageStore.values()].some(
        (row) => row.tenantId === tenantId && row.slug === candidate && row.id !== itemId
      );
      nextSlug = conflict
        ? uniqueCatalogSlug(tenantSlugs(guideLanguageStore, tenantId), candidate, "language")
        : candidate;
    }
    const updated: GuideLanguageResource = {
      ...current,
      ...(input.name !== undefined ? { name: input.name } : {}),
      slug: nextSlug,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date().toISOString(),
    };
    guideLanguageStore.set(resourceKey(tenantId, itemId), updated);
    return { ...updated };
  }

  async deleteGuideLanguage(tenantId: string, itemId: string): Promise<void> {
    const deleted = guideLanguageStore.delete(resourceKey(tenantId, itemId));
    if (!deleted) {
      throw new SettingsResourceNotFoundError(itemId);
    }
  }

  async seedGuideLanguage(record: GuideLanguageResource): Promise<void> {
    guideLanguageStore.set(resourceKey(record.tenantId, record.id), { ...record });
  }

  async getTourTheme(tenantId: string, themeId: string): Promise<TourThemeResource | null> {
    const row = tourThemeStore.get(resourceKey(tenantId, themeId));
    return row === undefined ? null : { ...row };
  }

  async listTourPresets(tenantId: string): Promise<TourPresetResource[]> {
    return [...tourPresetStore.values()]
      .filter((row) => row.tenantId === tenantId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async createTourPreset(
    tenantId: string,
    input: { name: string; description?: string; themeId?: string; isActive?: boolean }
  ): TourPresetResource {
    if (input.themeId !== undefined && input.themeId.trim().length > 0) {
      const theme = await this.getTourTheme(tenantId, input.themeId.trim());
      if (theme === null) {
        throw new SettingsResourceNotFoundError(input.themeId.trim());
      }
    }
    const now = new Date().toISOString();
    const existing = await this.listTourPresets(tenantId);
    const record: TourPresetResource = {
      id: randomUUID(),
      tenantId,
      name: input.name,
      description: input.description?.trim().length ? input.description.trim() : null,
      themeId:
        input.themeId !== undefined && input.themeId.trim().length > 0 ? input.themeId.trim() : null,
      isActive: input.isActive ?? true,
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now,
    };
    tourPresetStore.set(resourceKey(tenantId, record.id), record);
    return { ...record };
  }

  async patchTourPreset(
    tenantId: string,
    itemId: string,
    input: {
      name?: string;
      description?: string | null;
      themeId?: string | null;
      isActive?: boolean;
    }
  ): Promise<TourPresetResource> {
    const current = tourPresetStore.get(resourceKey(tenantId, itemId));
    if (current === undefined) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    if (input.themeId !== undefined && input.themeId !== null && input.themeId.trim().length > 0) {
      const theme = await this.getTourTheme(tenantId, input.themeId.trim());
      if (theme === null) {
        throw new SettingsResourceNotFoundError(input.themeId.trim());
      }
    }
    const updated: TourPresetResource = {
      ...current,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.themeId !== undefined
        ? {
            themeId:
              input.themeId === null || input.themeId.trim().length === 0 ? null : input.themeId.trim(),
          }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date().toISOString(),
    };
    tourPresetStore.set(resourceKey(tenantId, itemId), updated);
    return { ...updated };
  }

  async deleteTourPreset(tenantId: string, itemId: string): Promise<void> {
    const deleted = tourPresetStore.delete(resourceKey(tenantId, itemId));
    if (!deleted) {
      throw new SettingsResourceNotFoundError(itemId);
    }
  }

  async seedTourPreset(record: TourPresetResource): Promise<void> {
    tourPresetStore.set(resourceKey(record.tenantId, record.id), { ...record });
  }

  async listRegions(tenantId: string): Promise<RegionResource[]> {
    return [...regionStore.values()]
      .filter((row) => row.tenantId === tenantId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async listDestinations(tenantId: string): Promise<DestinationResource[]> {
    return [...destinationStore.values()]
      .filter((row) => row.tenantId === tenantId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async getRegion(tenantId: string, regionId: string): Promise<RegionResource | null> {
    const row = regionStore.get(resourceKey(tenantId, regionId));
    return row === undefined ? null : { ...row };
  }

  async createRegion(
    tenantId: string,
    input: { name: string; country?: string }
  ): Promise<RegionResource> {
    const now = new Date().toISOString();
    const existing = await this.listRegions(tenantId);
    const record: RegionResource = {
      id: randomUUID(),
      tenantId,
      name: input.name,
      country: input.country ?? null,
      isActive: true,
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now,
    };
    regionStore.set(resourceKey(tenantId, record.id), record);
    return { ...record };
  }

  async createDestination(
    tenantId: string,
    input: { regionId: string; name: string; locationType?: string }
  ): Promise<DestinationResource> {
    const region = await this.getRegion(tenantId, input.regionId);
    if (region === null) {
      throw new SettingsResourceNotFoundError(input.regionId);
    }
    const now = new Date().toISOString();
    const existing = (await this.listDestinations(tenantId)).filter(
      (row) => row.regionId === input.regionId
    );
    const record: DestinationResource = {
      id: randomUUID(),
      tenantId,
      regionId: input.regionId,
      name: input.name,
      locationType: input.locationType ?? null,
      altitudeM: null,
      isActive: true,
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now,
    };
    destinationStore.set(resourceKey(tenantId, record.id), record);
    return { ...record };
  }

  async patchRegion(
    tenantId: string,
    itemId: string,
    input: { name?: string; country?: string | null; isActive?: boolean }
  ): Promise<RegionResource> {
    const current = regionStore.get(resourceKey(tenantId, itemId));
    if (current === undefined) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    const updated: RegionResource = {
      ...current,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date().toISOString(),
    };
    regionStore.set(resourceKey(tenantId, itemId), updated);
    return { ...updated };
  }

  async patchDestination(
    tenantId: string,
    itemId: string,
    input: {
      name?: string;
      regionId?: string;
      locationType?: string | null;
      isActive?: boolean;
    }
  ): Promise<DestinationResource> {
    const current = destinationStore.get(resourceKey(tenantId, itemId));
    if (current === undefined) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    if (input.regionId !== undefined && (await this.getRegion(tenantId, input.regionId)) === null) {
      throw new SettingsResourceNotFoundError(input.regionId);
    }
    const updated: DestinationResource = {
      ...current,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.regionId !== undefined ? { regionId: input.regionId } : {}),
      ...(input.locationType !== undefined ? { locationType: input.locationType } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date().toISOString(),
    };
    destinationStore.set(resourceKey(tenantId, itemId), updated);
    return { ...updated };
  }

  async deleteRegion(tenantId: string, itemId: string): Promise<void> {
    const current = regionStore.get(resourceKey(tenantId, itemId));
    if (current === undefined) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    for (const destination of await this.listDestinations(tenantId)) {
      if (destination.regionId === itemId) {
        destinationStore.delete(resourceKey(tenantId, destination.id));
      }
    }
    regionStore.delete(resourceKey(tenantId, itemId));
  }

  async deleteDestination(tenantId: string, itemId: string): Promise<void> {
    const deleted = destinationStore.delete(resourceKey(tenantId, itemId));
    if (!deleted) {
      throw new SettingsResourceNotFoundError(itemId);
    }
  }

  async patchLocationResource(
    tenantId: string,
    itemId: string,
    input: {
      name?: string;
      country?: string | null;
      regionId?: string;
      locationType?: string | null;
      isActive?: boolean;
    }
  ): RegionResource | DestinationResource {
    if (regionStore.has(resourceKey(tenantId, itemId))) {
      return await this.patchRegion(tenantId, itemId, input);
    }
    return await this.patchDestination(tenantId, itemId, input);
  }

  async deleteLocationResource(tenantId: string, itemId: string): Promise<void> {
    if (regionStore.has(resourceKey(tenantId, itemId))) {
      await this.deleteRegion(tenantId, itemId);
      return;
    }
    await this.deleteDestination(tenantId, itemId);
  }

  async seedRegion(record: RegionResource): Promise<void> {
    regionStore.set(resourceKey(record.tenantId, record.id), { ...record });
  }

  async seedDestination(record: DestinationResource): Promise<void> {
    destinationStore.set(resourceKey(record.tenantId, record.id), { ...record });
  }
}

export class SettingsResourceNotFoundError extends Error {
  readonly code = "SETTINGS_RESOURCE_NOT_FOUND" as const;

  constructor(readonly itemId: string) {
    super(`SETTINGS_RESOURCE_NOT_FOUND:${itemId}`);
    this.name = "SettingsResourceNotFoundError";
  }
}
