import { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";

import {
  NATIVE_EXPOSURE_INTENT_SOURCE,
  type ExposureIntent,
  type ExposureIntentMode,
} from "./exposure-intent";
import { parseStoredFieldDecorations } from "./field-decorations";
import {
  exposureIntentScopeHash,
  normalizeExposureIntentScope,
  type ExposureIntentRepository,
  type ExposureIntentScope,
  type UpsertExposureIntentInput,
} from "./exposure-intent.repository";

function parseSelectedFieldIds(raw: Prisma.JsonValue | null): readonly string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is string => typeof entry === "string");
}

function parseMode(value: string): ExposureIntentMode {
  return value === "override_fields" || value === "disabled" ? value : "inherit_profile";
}

function parseScope(raw: Prisma.JsonValue): ExposureIntentScope {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  return raw as ExposureIntentScope;
}

function mapRow(row: {
  id: string;
  workspaceType: string | null;
  profileId: string;
  entityType: string;
  surface: string;
  audience: string;
  trigger: string;
  scope: Prisma.JsonValue;
  mode: string;
  selectedFieldIds: Prisma.JsonValue | null;
  fieldDecorations: Prisma.JsonValue | null;
  templateOverrideId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ExposureIntent {
  const templateOverrideId = row.templateOverrideId?.trim();
  const fieldDecorations = parseStoredFieldDecorations(row.fieldDecorations);
  return {
    id: row.id,
    profileId: row.profileId,
    workspaceType: row.workspaceType ?? "",
    entityType: row.entityType,
    surface: row.surface,
    audience: row.audience,
    trigger: row.trigger,
    scope: parseScope(row.scope),
    mode: parseMode(row.mode),
    selectedFieldIds: parseSelectedFieldIds(row.selectedFieldIds),
    ...(fieldDecorations === undefined ? {} : { fieldDecorations }),
    ...(templateOverrideId == null || templateOverrideId.length === 0
      ? {}
      : { templateOverrideId }),
    source: NATIVE_EXPOSURE_INTENT_SOURCE,
    sourceId: row.id,
    version: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaExposureIntentRepository implements ExposureIntentRepository {
  async findForContext(input: {
    readonly tenantId: string;
    readonly profileId: string;
    readonly surface: string;
    readonly audience: string;
    readonly trigger: string;
    readonly scope?: ExposureIntentScope;
  }): Promise<ExposureIntent | null> {
    const scopeHash = exposureIntentScopeHash(input.scope);
    return withTenantRls(input.tenantId, async (tx) => {
      const row = await tx.exposureIntent.findUnique({
        where: {
          tenantId_profileId_surface_audience_trigger_scopeHash: {
            tenantId: input.tenantId,
            profileId: input.profileId,
            surface: input.surface,
            audience: input.audience,
            trigger: input.trigger,
            scopeHash,
          },
        },
      });
      return row === null ? null : mapRow(row);
    });
  }

  async listForConnectionScope(input: {
    readonly tenantId: string;
    readonly connectionId: string;
  }): Promise<readonly ExposureIntent[]> {
    return withTenantRls(input.tenantId, async (tx) => {
      const rows = await tx.exposureIntent.findMany({
        where: {
          tenantId: input.tenantId,
          scope: {
            path: ["connectionId"],
            equals: input.connectionId,
          },
        },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(mapRow);
    });
  }

  async upsert(input: UpsertExposureIntentInput): Promise<ExposureIntent> {
    const normalizedScope = normalizeExposureIntentScope(input.scope);
    const scopeHash = exposureIntentScopeHash(normalizedScope);
    const selectedFieldIds =
      input.mode === "override_fields" ? [...(input.selectedFieldIds ?? [])] : null;
    const selectedFieldIdsPayload: Prisma.InputJsonValue | typeof Prisma.JsonNull =
      selectedFieldIds === null ? Prisma.JsonNull : selectedFieldIds;
    const fieldDecorationsPayload: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =
      input.fieldDecorations === undefined
        ? undefined
        : input.fieldDecorations === null
          ? Prisma.JsonNull
          : (input.fieldDecorations as Prisma.InputJsonValue);

    return withTenantRls(input.tenantId, async (tx) => {
      const row = await tx.exposureIntent.upsert({
        where: {
          tenantId_profileId_surface_audience_trigger_scopeHash: {
            tenantId: input.tenantId,
            profileId: input.profileId,
            surface: input.surface,
            audience: input.audience,
            trigger: input.trigger,
            scopeHash,
          },
        },
        create: {
          tenantId: input.tenantId,
          workspaceType: input.workspaceType,
          profileId: input.profileId,
          entityType: input.entityType,
          surface: input.surface,
          audience: input.audience,
          trigger: input.trigger,
          scope: normalizedScope as Prisma.InputJsonValue,
          scopeHash,
          mode: input.mode,
          selectedFieldIds: selectedFieldIdsPayload,
          ...(fieldDecorationsPayload === undefined ? {} : { fieldDecorations: fieldDecorationsPayload }),
          templateOverrideId: input.templateOverrideId ?? null,
          updatedByUserId: input.updatedByUserId ?? null,
          createdByUserId: input.updatedByUserId ?? null,
        },
        update: {
          workspaceType: input.workspaceType,
          entityType: input.entityType,
          mode: input.mode,
          selectedFieldIds: selectedFieldIdsPayload,
          ...(fieldDecorationsPayload === undefined ? {} : { fieldDecorations: fieldDecorationsPayload }),
          templateOverrideId: input.templateOverrideId ?? null,
          updatedByUserId: input.updatedByUserId ?? null,
        },
      });
      return mapRow(row);
    });
  }
}

export function createExposureIntentRepository(): ExposureIntentRepository {
  return new PrismaExposureIntentRepository();
}
