import { withTenantRls } from "../db/with-tenant-rls";
import { slugifyName, uniqueCatalogSlug } from "./settings-catalog-slug";
import type {
  DestinationResource,
  EquipmentResource,
  GuideLanguageResource,
  RegionResource,
  TourPresetResource,
  TourThemeResource,
} from "./settings.types";
import {
  SettingsResourceNotFoundError,
  type SettingsResourcesRepository,
} from "./in-memory-settings-resources.repository";
import { parseThemeIdsJson } from "./parse-theme-ids";

function toEquipment(row: {
  id: string;
  tenantId: string;
  name: string;
  category: string | null;
  iconKey: string | null;
  themeIds: unknown;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): EquipmentResource {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    category: row.category,
    iconKey: row.iconKey,
    themeIds: parseThemeIdsJson(row.themeIds),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTourTheme(row: {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  formProfile: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): TourThemeResource {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    slug: row.slug,
    formProfile: row.formProfile,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toGuideLanguage(row: {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): GuideLanguageResource {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    slug: row.slug,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTourPreset(row: {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  themeId: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): TourPresetResource {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    themeId: row.themeId,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRegion(row: {
  id: string;
  tenantId: string;
  name: string;
  country: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): RegionResource {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    country: row.country,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDestination(row: {
  id: string;
  tenantId: string;
  regionId: string;
  name: string;
  locationType: string | null;
  altitudeM: number | null;
  typicalTrailDistanceKm: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): DestinationResource {
  return {
    id: row.id,
    tenantId: row.tenantId,
    regionId: row.regionId,
    name: row.name,
    locationType: row.locationType,
    altitudeM: row.altitudeM,
    typicalTrailDistanceKm: row.typicalTrailDistanceKm,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeOptionalPositiveFloat(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function normalizeOptionalPositiveInt(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.trunc(value);
}

async function resolveUniqueSlug(
  tenantId: string,
  table: "workspaceTourTheme" | "workspaceGuideLanguage",
  baseSlug: string,
  fallback: string,
  excludeId?: string
): Promise<string> {
  const rows = await withTenantRls(tenantId, (tx) => {
    if (table === "workspaceTourTheme") {
      return tx.workspaceTourTheme.findMany({
        where: { tenantId, ...(excludeId !== undefined ? { id: { not: excludeId } } : {}) },
        select: { slug: true },
      });
    }
    return tx.workspaceGuideLanguage.findMany({
      where: { tenantId, ...(excludeId !== undefined ? { id: { not: excludeId } } : {}) },
      select: { slug: true },
    });
  });
  return uniqueCatalogSlug(
    rows.map((row) => row.slug),
    baseSlug,
    fallback
  );
}

export class PrismaSettingsResourcesRepository implements SettingsResourcesRepository {
  async listEquipment(tenantId: string): Promise<EquipmentResource[]> {
    const rows = await withTenantRls(tenantId, (tx) =>
      tx.workspaceEquipment.findMany({
        where: { tenantId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    );
    return rows.map((row) => toEquipment(row));
  }

  async getEquipment(tenantId: string, itemId: string): Promise<EquipmentResource | null> {
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceEquipment.findFirst({ where: { tenantId, id: itemId } })
    );
    return row === null ? null : toEquipment(row);
  }

  async createEquipment(
    tenantId: string,
    input: { name: string; category?: string; iconKey?: string | null; themeIds?: readonly string[] }
  ): Promise<EquipmentResource> {
    const existing = await this.listEquipment(tenantId);
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceEquipment.create({
        data: {
          tenantId,
          name: input.name,
          category: input.category ?? null,
          iconKey: input.iconKey ?? null,
          themeIds: input.themeIds ?? [],
          sortOrder: existing.length,
        },
      })
    );
    return toEquipment(row);
  }

  async patchEquipment(
    tenantId: string,
    itemId: string,
    input: { name?: string; category?: string | null; iconKey?: string | null; themeIds?: readonly string[] }
  ): Promise<EquipmentResource> {
    const current = await this.getEquipment(tenantId, itemId);
    if (current === null) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceEquipment.update({
        where: { id: itemId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
          ...(input.themeIds !== undefined ? { themeIds: [...input.themeIds] } : {}),
        },
      })
    );
    return toEquipment(row);
  }

  async deleteEquipment(tenantId: string, itemId: string): Promise<void> {
    const current = await this.getEquipment(tenantId, itemId);
    if (current === null) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    await withTenantRls(tenantId, (tx) => tx.workspaceEquipment.delete({ where: { id: itemId } }));
  }

  async seedEquipment(record: EquipmentResource): Promise<void> {
    await withTenantRls(record.tenantId, async (tx) => {
      const existing = await tx.workspaceEquipment.findFirst({
        where: { tenantId: record.tenantId, id: record.id },
        select: { id: true },
      });
      const data = {
        name: record.name,
        category: record.category,
        iconKey: record.iconKey ?? null,
        themeIds: [...record.themeIds],
        sortOrder: record.sortOrder,
        updatedAt: new Date(record.updatedAt),
      };
      if (existing === null) {
        await tx.workspaceEquipment.create({
          data: {
            id: record.id,
            tenantId: record.tenantId,
            ...data,
            createdAt: new Date(record.createdAt),
          },
        });
        return;
      }
      await tx.workspaceEquipment.update({ where: { id: record.id }, data });
    });
  }

  async listTourThemes(tenantId: string): Promise<TourThemeResource[]> {
    const rows = await withTenantRls(tenantId, (tx) =>
      tx.workspaceTourTheme.findMany({
        where: { tenantId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    );
    return rows.map((row) => toTourTheme(row));
  }

  async getTourTheme(tenantId: string, themeId: string): Promise<TourThemeResource | null> {
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceTourTheme.findFirst({ where: { tenantId, id: themeId } })
    );
    return row === null ? null : toTourTheme(row);
  }

  async createTourTheme(
    tenantId: string,
    input: { name: string; slug?: string; isActive?: boolean }
  ): Promise<TourThemeResource> {
    const existing = await this.listTourThemes(tenantId);
    const baseSlug = slugifyName(input.slug ?? input.name);
    const slug = await resolveUniqueSlug(tenantId, "workspaceTourTheme", baseSlug, "theme");
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceTourTheme.create({
        data: {
          tenantId,
          name: input.name,
          slug,
          isActive: input.isActive ?? true,
          sortOrder: existing.length,
        },
      })
    );
    return toTourTheme(row);
  }

  async patchTourTheme(
    tenantId: string,
    itemId: string,
    input: { name?: string; slug?: string; isActive?: boolean }
  ): Promise<TourThemeResource> {
    const current = await this.getTourTheme(tenantId, itemId);
    if (current === null) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    let nextSlug = current.slug;
    if (input.slug !== undefined) {
      const candidate = slugifyName(input.slug);
      const rows = await withTenantRls(tenantId, (tx) =>
        tx.workspaceTourTheme.findMany({
          where: { tenantId, id: { not: itemId } },
          select: { slug: true },
        })
      );
      const conflict = rows.some((row) => row.slug === candidate);
      nextSlug = conflict
        ? uniqueCatalogSlug(
            rows.map((row) => row.slug),
            candidate,
            "theme"
          )
        : candidate;
    }
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceTourTheme.update({
        where: { id: itemId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          slug: nextSlug,
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      })
    );
    return toTourTheme(row);
  }

  async deleteTourTheme(tenantId: string, itemId: string): Promise<void> {
    const current = await this.getTourTheme(tenantId, itemId);
    if (current === null) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    await withTenantRls(tenantId, (tx) => tx.workspaceTourTheme.delete({ where: { id: itemId } }));
  }

  async seedTourTheme(record: TourThemeResource): Promise<void> {
    await withTenantRls(record.tenantId, async (tx) => {
      const existing = await tx.workspaceTourTheme.findFirst({
        where: { tenantId: record.tenantId, id: record.id },
        select: { id: true },
      });
      const data = {
        name: record.name,
        slug: record.slug,
        isActive: record.isActive,
        sortOrder: record.sortOrder,
        updatedAt: new Date(record.updatedAt),
      };
      if (existing === null) {
        await tx.workspaceTourTheme.create({
          data: {
            id: record.id,
            tenantId: record.tenantId,
            ...data,
            createdAt: new Date(record.createdAt),
          },
        });
        return;
      }
      await tx.workspaceTourTheme.update({ where: { id: record.id }, data });
    });
  }

  async listGuideLanguages(tenantId: string): Promise<GuideLanguageResource[]> {
    const rows = await withTenantRls(tenantId, (tx) =>
      tx.workspaceGuideLanguage.findMany({
        where: { tenantId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    );
    return rows.map((row) => toGuideLanguage(row));
  }

  async createGuideLanguage(
    tenantId: string,
    input: { name: string; slug?: string; isActive?: boolean }
  ): Promise<GuideLanguageResource> {
    const existing = await this.listGuideLanguages(tenantId);
    const baseSlug = slugifyName(input.slug ?? input.name);
    const slug = await resolveUniqueSlug(tenantId, "workspaceGuideLanguage", baseSlug, "language");
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceGuideLanguage.create({
        data: {
          tenantId,
          name: input.name,
          slug,
          isActive: input.isActive ?? true,
          sortOrder: existing.length,
        },
      })
    );
    return toGuideLanguage(row);
  }

  async patchGuideLanguage(
    tenantId: string,
    itemId: string,
    input: { name?: string; slug?: string; isActive?: boolean }
  ): Promise<GuideLanguageResource> {
    const current = await withTenantRls(tenantId, (tx) =>
      tx.workspaceGuideLanguage.findFirst({ where: { tenantId, id: itemId } })
    );
    if (current === null) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    let nextSlug = current.slug;
    if (input.slug !== undefined) {
      const candidate = slugifyName(input.slug);
      const rows = await withTenantRls(tenantId, (tx) =>
        tx.workspaceGuideLanguage.findMany({
          where: { tenantId, id: { not: itemId } },
          select: { slug: true },
        })
      );
      const conflict = rows.some((row) => row.slug === candidate);
      nextSlug = conflict
        ? uniqueCatalogSlug(
            rows.map((row) => row.slug),
            candidate,
            "language"
          )
        : candidate;
    }
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceGuideLanguage.update({
        where: { id: itemId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          slug: nextSlug,
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      })
    );
    return toGuideLanguage(row);
  }

  async deleteGuideLanguage(tenantId: string, itemId: string): Promise<void> {
    const current = await withTenantRls(tenantId, (tx) =>
      tx.workspaceGuideLanguage.findFirst({ where: { tenantId, id: itemId } })
    );
    if (current === null) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    await withTenantRls(tenantId, (tx) => tx.workspaceGuideLanguage.delete({ where: { id: itemId } }));
  }

  async seedGuideLanguage(record: GuideLanguageResource): Promise<void> {
    await withTenantRls(record.tenantId, async (tx) => {
      const existing = await tx.workspaceGuideLanguage.findFirst({
        where: { tenantId: record.tenantId, id: record.id },
        select: { id: true },
      });
      const data = {
        name: record.name,
        slug: record.slug,
        isActive: record.isActive,
        sortOrder: record.sortOrder,
        updatedAt: new Date(record.updatedAt),
      };
      if (existing === null) {
        await tx.workspaceGuideLanguage.create({
          data: {
            id: record.id,
            tenantId: record.tenantId,
            ...data,
            createdAt: new Date(record.createdAt),
          },
        });
        return;
      }
      await tx.workspaceGuideLanguage.update({ where: { id: record.id }, data });
    });
  }

  async listTourPresets(tenantId: string): Promise<TourPresetResource[]> {
    const rows = await withTenantRls(tenantId, (tx) =>
      tx.workspaceTourPreset.findMany({
        where: { tenantId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    );
    return rows.map((row) => toTourPreset(row));
  }

  async createTourPreset(
    tenantId: string,
    input: { name: string; description?: string; themeId?: string; isActive?: boolean }
  ): Promise<TourPresetResource> {
    if (input.themeId !== undefined && input.themeId.trim().length > 0) {
      const theme = await this.getTourTheme(tenantId, input.themeId.trim());
      if (theme === null) {
        throw new SettingsResourceNotFoundError(input.themeId.trim());
      }
    }
    const existing = await this.listTourPresets(tenantId);
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceTourPreset.create({
        data: {
          tenantId,
          name: input.name,
          description: input.description?.trim().length ? input.description.trim() : null,
          themeId:
            input.themeId !== undefined && input.themeId.trim().length > 0
              ? input.themeId.trim()
              : null,
          isActive: input.isActive ?? true,
          sortOrder: existing.length,
        },
      })
    );
    return toTourPreset(row);
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
    const current = await withTenantRls(tenantId, (tx) =>
      tx.workspaceTourPreset.findFirst({ where: { tenantId, id: itemId } })
    );
    if (current === null) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    if (input.themeId !== undefined && input.themeId !== null && input.themeId.trim().length > 0) {
      const theme = await this.getTourTheme(tenantId, input.themeId.trim());
      if (theme === null) {
        throw new SettingsResourceNotFoundError(input.themeId.trim());
      }
    }
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceTourPreset.update({
        where: { id: itemId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.themeId !== undefined
            ? {
                themeId:
                  input.themeId === null || input.themeId.trim().length === 0
                    ? null
                    : input.themeId.trim(),
              }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      })
    );
    return toTourPreset(row);
  }

  async deleteTourPreset(tenantId: string, itemId: string): Promise<void> {
    const current = await withTenantRls(tenantId, (tx) =>
      tx.workspaceTourPreset.findFirst({ where: { tenantId, id: itemId } })
    );
    if (current === null) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    await withTenantRls(tenantId, (tx) => tx.workspaceTourPreset.delete({ where: { id: itemId } }));
  }

  async seedTourPreset(record: TourPresetResource): Promise<void> {
    await withTenantRls(record.tenantId, async (tx) => {
      const existing = await tx.workspaceTourPreset.findFirst({
        where: { tenantId: record.tenantId, id: record.id },
        select: { id: true },
      });
      const data = {
        name: record.name,
        description: record.description,
        themeId: record.themeId,
        isActive: record.isActive,
        sortOrder: record.sortOrder,
        updatedAt: new Date(record.updatedAt),
      };
      if (existing === null) {
        await tx.workspaceTourPreset.create({
          data: {
            id: record.id,
            tenantId: record.tenantId,
            ...data,
            createdAt: new Date(record.createdAt),
          },
        });
        return;
      }
      await tx.workspaceTourPreset.update({ where: { id: record.id }, data });
    });
  }

  async listRegions(tenantId: string): Promise<RegionResource[]> {
    const rows = await withTenantRls(tenantId, (tx) =>
      tx.workspaceRegion.findMany({
        where: { tenantId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    );
    return rows.map((row) => toRegion(row));
  }

  async listDestinations(tenantId: string): Promise<DestinationResource[]> {
    const rows = await withTenantRls(tenantId, (tx) =>
      tx.workspaceDestination.findMany({
        where: { tenantId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    );
    return rows.map((row) => toDestination(row));
  }

  async getRegion(tenantId: string, regionId: string): Promise<RegionResource | null> {
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceRegion.findFirst({ where: { tenantId, id: regionId } })
    );
    return row === null ? null : toRegion(row);
  }

  async createRegion(
    tenantId: string,
    input: { name: string; country?: string }
  ): Promise<RegionResource> {
    const existing = await this.listRegions(tenantId);
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceRegion.create({
        data: {
          tenantId,
          name: input.name,
          country: input.country ?? null,
          sortOrder: existing.length,
        },
      })
    );
    return toRegion(row);
  }

  async createDestination(
    tenantId: string,
    input: {
      regionId: string;
      name: string;
      locationType?: string;
      altitudeM?: number | null;
      typicalTrailDistanceKm?: number | null;
    }
  ): Promise<DestinationResource> {
    const region = await this.getRegion(tenantId, input.regionId);
    if (region === null) {
      throw new SettingsResourceNotFoundError(input.regionId);
    }
    const existing = (await this.listDestinations(tenantId)).filter(
      (row) => row.regionId === input.regionId
    );
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceDestination.create({
        data: {
          tenantId,
          regionId: input.regionId,
          name: input.name,
          locationType: input.locationType ?? null,
          altitudeM: normalizeOptionalPositiveInt(input.altitudeM),
          typicalTrailDistanceKm: normalizeOptionalPositiveFloat(input.typicalTrailDistanceKm),
          sortOrder: existing.length,
        },
      })
    );
    return toDestination(row);
  }

  async patchRegion(
    tenantId: string,
    itemId: string,
    input: { name?: string; country?: string | null; isActive?: boolean }
  ): Promise<RegionResource> {
    const current = await this.getRegion(tenantId, itemId);
    if (current === null) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceRegion.update({
        where: { id: itemId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.country !== undefined ? { country: input.country } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      })
    );
    return toRegion(row);
  }

  async patchDestination(
    tenantId: string,
    itemId: string,
    input: {
      name?: string;
      regionId?: string;
      locationType?: string | null;
      altitudeM?: number | null;
      typicalTrailDistanceKm?: number | null;
      isActive?: boolean;
    }
  ): Promise<DestinationResource> {
    const current = await withTenantRls(tenantId, (tx) =>
      tx.workspaceDestination.findFirst({ where: { tenantId, id: itemId } })
    );
    if (current === null) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    if (input.regionId !== undefined && (await this.getRegion(tenantId, input.regionId)) === null) {
      throw new SettingsResourceNotFoundError(input.regionId);
    }
    const row = await withTenantRls(tenantId, (tx) =>
      tx.workspaceDestination.update({
        where: { id: itemId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.regionId !== undefined ? { regionId: input.regionId } : {}),
          ...(input.locationType !== undefined ? { locationType: input.locationType } : {}),
          ...(input.altitudeM !== undefined
            ? { altitudeM: normalizeOptionalPositiveInt(input.altitudeM) }
            : {}),
          ...(input.typicalTrailDistanceKm !== undefined
            ? { typicalTrailDistanceKm: normalizeOptionalPositiveFloat(input.typicalTrailDistanceKm) }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      })
    );
    return toDestination(row);
  }

  async deleteRegion(tenantId: string, itemId: string): Promise<void> {
    const current = await this.getRegion(tenantId, itemId);
    if (current === null) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    await withTenantRls(tenantId, (tx) => {
      return tx.workspaceDestination.deleteMany({ where: { tenantId, regionId: itemId } }).then(() =>
        tx.workspaceRegion.delete({ where: { id: itemId } })
      );
    });
  }

  async deleteDestination(tenantId: string, itemId: string): Promise<void> {
    const current = await withTenantRls(tenantId, (tx) =>
      tx.workspaceDestination.findFirst({ where: { tenantId, id: itemId } })
    );
    if (current === null) {
      throw new SettingsResourceNotFoundError(itemId);
    }
    await withTenantRls(tenantId, (tx) => tx.workspaceDestination.delete({ where: { id: itemId } }));
  }

  async patchLocationResource(
    tenantId: string,
    itemId: string,
    input: {
      name?: string;
      country?: string | null;
      regionId?: string;
      locationType?: string | null;
      altitudeM?: number | null;
      typicalTrailDistanceKm?: number | null;
      isActive?: boolean;
    }
  ): Promise<RegionResource | DestinationResource> {
    const region = await this.getRegion(tenantId, itemId);
    if (region !== null) {
      return this.patchRegion(tenantId, itemId, input);
    }
    return this.patchDestination(tenantId, itemId, input);
  }

  async deleteLocationResource(tenantId: string, itemId: string): Promise<void> {
    const region = await this.getRegion(tenantId, itemId);
    if (region !== null) {
      await this.deleteRegion(tenantId, itemId);
      return;
    }
    await this.deleteDestination(tenantId, itemId);
  }

  async seedRegion(record: RegionResource): Promise<void> {
    await withTenantRls(record.tenantId, async (tx) => {
      const existing = await tx.workspaceRegion.findFirst({
        where: { tenantId: record.tenantId, id: record.id },
        select: { id: true },
      });
      const data = {
        name: record.name,
        country: record.country,
        isActive: record.isActive,
        sortOrder: record.sortOrder,
        updatedAt: new Date(record.updatedAt),
      };
      if (existing === null) {
        await tx.workspaceRegion.create({
          data: {
            id: record.id,
            tenantId: record.tenantId,
            ...data,
            createdAt: new Date(record.createdAt),
          },
        });
        return;
      }
      await tx.workspaceRegion.update({ where: { id: record.id }, data });
    });
  }

  async seedDestination(record: DestinationResource): Promise<void> {
    await withTenantRls(record.tenantId, async (tx) => {
      const existing = await tx.workspaceDestination.findFirst({
        where: { tenantId: record.tenantId, id: record.id },
        select: { id: true },
      });
      const data = {
        name: record.name,
        regionId: record.regionId,
        locationType: record.locationType,
        altitudeM: record.altitudeM,
        typicalTrailDistanceKm: record.typicalTrailDistanceKm,
        isActive: record.isActive,
        sortOrder: record.sortOrder,
        updatedAt: new Date(record.updatedAt),
      };
      if (existing === null) {
        await tx.workspaceDestination.create({
          data: {
            id: record.id,
            tenantId: record.tenantId,
            ...data,
            createdAt: new Date(record.createdAt),
          },
        });
        return;
      }
      await tx.workspaceDestination.update({ where: { id: record.id }, data });
    });
  }
}
