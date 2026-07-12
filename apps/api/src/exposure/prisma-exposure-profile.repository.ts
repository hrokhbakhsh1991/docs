import { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";

import {
  NATIVE_PERSISTED_EXPOSURE_PROFILE_SOURCE,
  REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED,
  type ExposureProfile,
  type ExposureProfileSource,
} from "./exposure-profile";
import type {
  EnsureSeededExposureProfileInput,
  ExposureProfileRepository,
} from "./exposure-profile.repository";

function parseDefaultFieldIds(raw: Prisma.JsonValue): readonly string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is string => typeof entry === "string");
}

function parseProfileSource(value: string): ExposureProfileSource {
  return value === NATIVE_PERSISTED_EXPOSURE_PROFILE_SOURCE
    ? NATIVE_PERSISTED_EXPOSURE_PROFILE_SOURCE
    : REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED;
}

function mapRow(row: {
  profileId: string;
  workspaceType: string | null;
  entityType: string;
  surface: string;
  audience: string;
  trigger: string;
  defaultFieldIds: Prisma.JsonValue;
  defaultTemplateId: string | null;
  source: string;
  version: number;
}): ExposureProfile {
  const workspaceType = row.workspaceType?.trim();
  const defaultTemplateId = row.defaultTemplateId?.trim();
  return {
    id: row.profileId,
    workspaceType: workspaceType == null || workspaceType.length === 0 ? "unknown" : workspaceType,
    entityType: row.entityType,
    surface: row.surface,
    audience: row.audience,
    trigger: row.trigger,
    defaultFieldIds: parseDefaultFieldIds(row.defaultFieldIds),
    ...(defaultTemplateId == null || defaultTemplateId.length === 0
      ? {}
      : { defaultTemplateId }),
    source: parseProfileSource(row.source),
    version: `v${row.version}`,
  };
}

export class PrismaExposureProfileRepository implements ExposureProfileRepository {
  async findByProfileId(input: {
    readonly tenantId: string;
    readonly profileId: string;
  }): Promise<ExposureProfile | null> {
    return withTenantRls(input.tenantId, async (tx) => {
      const row = await tx.exposureProfile.findUnique({
        where: {
          tenantId_profileId: {
            tenantId: input.tenantId,
            profileId: input.profileId,
          },
        },
      });
      return row === null ? null : mapRow(row);
    });
  }

  async ensureSeededProfile(input: EnsureSeededExposureProfileInput): Promise<ExposureProfile> {
    const batch = await this.ensureSeededProfiles({
      tenantId: input.tenantId,
      seeds: [input.seed],
    });
    const profile = batch.get(input.seed.id);
    if (profile === undefined) {
      throw new Error(`EXPOSURE_PROFILE_SEED_FAILED:${input.seed.id}`);
    }
    return profile;
  }

  async ensureSeededProfiles(input: {
    readonly tenantId: string;
    readonly seeds: readonly ExposureProfile[];
  }): Promise<ReadonlyMap<string, ExposureProfile>> {
    const uniqueSeeds = [...new Map(input.seeds.map((seed) => [seed.id, seed])).values()];
    if (uniqueSeeds.length === 0) {
      return new Map();
    }

    const existingRows = await withTenantRls(input.tenantId, async (tx) =>
      tx.exposureProfile.findMany({
        where: {
          tenantId: input.tenantId,
          profileId: { in: uniqueSeeds.map((seed) => seed.id) },
        },
      }),
    );

    const profiles = new Map(existingRows.map((row) => [row.profileId, mapRow(row)]));
    const missingSeeds = uniqueSeeds.filter((seed) => !profiles.has(seed.id));

    if (missingSeeds.length > 0) {
      await withTenantRls(input.tenantId, async (tx) => {
        await tx.exposureProfile.createMany({
          data: missingSeeds.map((seed) => ({
            tenantId: input.tenantId,
            workspaceType: seed.workspaceType,
            profileId: seed.id,
            entityType: seed.entityType,
            surface: seed.surface,
            audience: seed.audience,
            trigger: seed.trigger,
            defaultFieldIds: [...seed.defaultFieldIds],
            defaultTemplateId: seed.defaultTemplateId ?? null,
            source: seed.source,
            version: 1,
          })),
          skipDuplicates: true,
        });
      });

      const createdRows = await withTenantRls(input.tenantId, async (tx) =>
        tx.exposureProfile.findMany({
          where: {
            tenantId: input.tenantId,
            profileId: { in: missingSeeds.map((seed) => seed.id) },
          },
        }),
      );
      for (const row of createdRows) {
        profiles.set(row.profileId, mapRow(row));
      }
    }

    return profiles;
  }
}

export function createExposureProfileRepository(): ExposureProfileRepository {
  return new PrismaExposureProfileRepository();
}
