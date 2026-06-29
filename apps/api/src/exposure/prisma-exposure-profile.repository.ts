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
    const existing = await this.findByProfileId({
      tenantId: input.tenantId,
      profileId: input.seed.id,
    });
    if (existing !== null) {
      return existing;
    }

    return withTenantRls(input.tenantId, async (tx) => {
      const row = await tx.exposureProfile.create({
        data: {
          tenantId: input.tenantId,
          workspaceType: input.seed.workspaceType,
          profileId: input.seed.id,
          entityType: input.seed.entityType,
          surface: input.seed.surface,
          audience: input.seed.audience,
          trigger: input.seed.trigger,
          defaultFieldIds: [...input.seed.defaultFieldIds],
          defaultTemplateId: input.seed.defaultTemplateId ?? null,
          source: input.seed.source,
          version: 1,
        },
      });
      return mapRow(row);
    });
  }
}

export function createExposureProfileRepository(): ExposureProfileRepository {
  return new PrismaExposureProfileRepository();
}
