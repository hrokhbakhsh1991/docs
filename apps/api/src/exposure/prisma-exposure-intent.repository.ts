import { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";

import {
  NATIVE_EXPOSURE_INTENT_SOURCE,
  type ExposureIntent,
  type ExposureIntentMode,
} from "./exposure-intent";
import { parseStoredFieldDecorations } from "./field-decorations";
import {
  EXPOSURE_INTENT_LIST_SELECT,
  MAX_EXPOSURE_INTENTS_CONNECTION_BATCH,
  MAX_EXPOSURE_INTENTS_PER_CONNECTION,
} from "./exposure-intent-list-projection";
import {
  exposureIntentContextLookupKey,
  exposureIntentScopeHash,
  normalizeExposureIntentScope,
  type ExposureIntentContextKey,
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

function groupIntentsByConnectionId(
  rows: readonly ReturnType<typeof mapRow>[],
): ReadonlyMap<string, readonly ExposureIntent[]> {
  const grouped = new Map<string, ExposureIntent[]>();
  for (const mapped of rows) {
    const connectionId = mapped.scope.connectionId;
    if (typeof connectionId !== "string" || connectionId.length === 0) {
      continue;
    }
    const list = grouped.get(connectionId) ?? [];
    if (list.length < MAX_EXPOSURE_INTENTS_PER_CONNECTION) {
      list.push(mapped);
      grouped.set(connectionId, list);
    }
  }
  return grouped;
}

export class PrismaExposureIntentRepository implements ExposureIntentRepository {
  async findForContext(input: ExposureIntentContextKey): Promise<ExposureIntent | null> {
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

  async findForContexts(
    contexts: readonly ExposureIntentContextKey[],
  ): Promise<ReadonlyMap<string, ExposureIntent>> {
    if (contexts.length === 0) {
      return new Map();
    }

    const tenantId = contexts[0]!.tenantId;
    const rows = await withTenantRls(tenantId, async (tx) =>
      tx.exposureIntent.findMany({
        where: {
          tenantId,
          OR: contexts.map((context) => ({
            profileId: context.profileId,
            surface: context.surface,
            audience: context.audience,
            trigger: context.trigger,
            scopeHash: exposureIntentScopeHash(context.scope),
          })),
        },
        select: EXPOSURE_INTENT_LIST_SELECT,
      }),
    );

    const lookup = new Map<string, ExposureIntent>();
    for (const row of rows) {
      const intent = mapRow(row);
      const key = exposureIntentContextLookupKey({
        tenantId,
        profileId: intent.profileId,
        surface: intent.surface,
        audience: intent.audience,
        trigger: intent.trigger,
        scope: intent.scope,
      });
      if (!lookup.has(key)) {
        lookup.set(key, intent);
      }
    }
    return lookup;
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
        select: EXPOSURE_INTENT_LIST_SELECT,
        orderBy: { updatedAt: "desc" },
        take: MAX_EXPOSURE_INTENTS_PER_CONNECTION,
      });
      return rows.map(mapRow);
    });
  }

  async listForConnectionScopes(input: {
    readonly tenantId: string;
    readonly connectionIds: readonly string[];
  }): Promise<ReadonlyMap<string, readonly ExposureIntent[]>> {
    if (input.connectionIds.length === 0) {
      return new Map();
    }

    const rows = await withTenantRls(input.tenantId, async (tx) =>
      tx.exposureIntent.findMany({
        where: {
          tenantId: input.tenantId,
          OR: input.connectionIds.map((connectionId) => ({
            scope: {
              path: ["connectionId"],
              equals: connectionId,
            },
          })),
        },
        select: EXPOSURE_INTENT_LIST_SELECT,
        orderBy: { updatedAt: "desc" },
        take: MAX_EXPOSURE_INTENTS_CONNECTION_BATCH,
      }),
    );

    return groupIntentsByConnectionId(rows.map(mapRow));
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
