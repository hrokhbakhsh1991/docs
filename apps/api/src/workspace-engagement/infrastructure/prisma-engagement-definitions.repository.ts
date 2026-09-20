import { Prisma } from "@prisma/client";

import { withTenantRls } from "../../db/with-tenant-rls";
import type {
  EngagementDedupePolicy,
  EngagementDefinitionStatus,
} from "../engagement-admin-catalog";
import { isApprovedBadgeIconKey } from "../engagement-admin-catalog";
import type {
  EngagementAwardRuleDefinitionRow,
  EngagementBadgeDefinitionRow,
  EngagementDefinitionAuditRow,
  EngagementI18nText,
  EngagementLevelDefinitionRow,
} from "../engagement-definition.types";
import {
  DEFAULT_ENGAGEMENT_AWARD_RULES,
  DEFAULT_ENGAGEMENT_BADGES,
  DEFAULT_ENGAGEMENT_LEVELS,
} from "../engagement-policy";

function throwEngagementRepoError(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

export function parseI18nJson(value: unknown): EngagementI18nText {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ENGAGEMENT_I18N_INVALID");
  }
  const record = value as Record<string, unknown>;
  const fa = record.fa;
  const en = record.en;
  if (typeof fa !== "string" || fa.trim().length < 1) {
    throw new Error("ENGAGEMENT_I18N_INVALID");
  }
  if (typeof en !== "string" || en.trim().length < 1) {
    throw new Error("ENGAGEMENT_I18N_INVALID");
  }
  return { fa: fa.trim(), en: en.trim() };
}

function toI18nJson(value: EngagementI18nText): Prisma.InputJsonValue {
  return { fa: value.fa, en: value.en };
}

function mapBadgeRow(row: {
  id: string;
  tenantId: string;
  workspaceId: string;
  code: string;
  titleI18n: Prisma.JsonValue;
  descriptionI18n: Prisma.JsonValue;
  iconKey: string;
  status: string;
  triggerKind: string;
  triggerEventType: string | null;
  triggerMinPoints: number | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}): EngagementBadgeDefinitionRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    code: row.code,
    titleI18n: parseI18nJson(row.titleI18n),
    descriptionI18n: parseI18nJson(row.descriptionI18n),
    iconKey: row.iconKey,
    status: row.status as EngagementDefinitionStatus,
    triggerKind: row.triggerKind as "event" | "points_threshold",
    triggerEventType: row.triggerEventType,
    triggerMinPoints: row.triggerMinPoints,
    rowVersion: row.rowVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  };
}

function mapLevelRow(row: {
  id: string;
  tenantId: string;
  workspaceId: string;
  code: string;
  titleI18n: Prisma.JsonValue;
  descriptionI18n: Prisma.JsonValue;
  minPoints: number;
  sortOrder: number;
  status: string;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): EngagementLevelDefinitionRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    code: row.code,
    titleI18n: parseI18nJson(row.titleI18n),
    descriptionI18n: parseI18nJson(row.descriptionI18n),
    minPoints: row.minPoints,
    sortOrder: row.sortOrder,
    status: row.status as EngagementDefinitionStatus,
    rowVersion: row.rowVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAwardRuleRow(row: {
  id: string;
  tenantId: string;
  workspaceId: string;
  eventType: string;
  sourceModule: string;
  points: number;
  badgeCode: string | null;
  status: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  dedupePolicy: string;
  version: number;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): EngagementAwardRuleDefinitionRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    eventType: row.eventType,
    sourceModule: row.sourceModule,
    points: row.points,
    badgeCode: row.badgeCode,
    status: row.status as EngagementDefinitionStatus,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    dedupePolicy: row.dedupePolicy as EngagementDedupePolicy,
    version: row.version,
    rowVersion: row.rowVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAuditRow(row: {
  id: string;
  tenantId: string;
  workspaceId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string;
  actorRole: string;
  beforeJson: Prisma.JsonValue | null;
  afterJson: Prisma.JsonValue | null;
  createdAt: Date;
}): EngagementDefinitionAuditRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    entityType: row.entityType as EngagementDefinitionAuditRow["entityType"],
    entityId: row.entityId,
    action: row.action,
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    beforeJson: row.beforeJson,
    afterJson: row.afterJson,
    createdAt: row.createdAt,
  };
}

export function findBadgeDefinitionFromRows(
  code: string,
  rows: readonly EngagementBadgeDefinitionRow[],
): EngagementBadgeDefinitionRow | undefined {
  return rows.find((row) => row.code === code && row.status === "active");
}

async function assertActiveBadgeRef(
  tx: Prisma.TransactionClient,
  tenantId: string,
  workspaceId: string,
  badgeCode: string | null | undefined,
): Promise<void> {
  if (badgeCode === null || badgeCode === undefined || badgeCode.trim().length === 0) {
    return;
  }
  const rows = await tx.engagementBadgeDefinition.findMany({
    where: { tenantId, workspaceId, status: "active" },
  });
  if (findBadgeDefinitionFromRows(badgeCode, rows.map(mapBadgeRow)) === undefined) {
    throwEngagementRepoError("ENGAGEMENT_BADGE_REF_INVALID", "badge reference invalid");
  }
}

async function assertLevelThresholdAvailable(
  tx: Prisma.TransactionClient,
  tenantId: string,
  workspaceId: string,
  minPoints: number,
  excludeCode?: string,
): Promise<void> {
  const conflict = await tx.engagementLevelDefinition.findFirst({
    where: {
      tenantId,
      workspaceId,
      status: "active",
      minPoints,
      ...(excludeCode !== undefined ? { NOT: { code: excludeCode } } : {}),
    },
  });
  if (conflict !== null) {
    throwEngagementRepoError(
      "ENGAGEMENT_LEVEL_THRESHOLD_CONFLICT",
      "level threshold conflict",
    );
  }
}

async function closePriorActiveAwardRules(
  tx: Prisma.TransactionClient,
  tenantId: string,
  workspaceId: string,
  eventType: string,
  effectiveTo: Date,
  excludeId?: string,
): Promise<void> {
  await tx.engagementAwardRuleDefinition.updateMany({
    where: {
      tenantId,
      workspaceId,
      eventType,
      status: "active",
      effectiveTo: null,
      ...(excludeId !== undefined ? { NOT: { id: excludeId } } : {}),
    },
    data: { effectiveTo },
  });
}

async function loadBadgeByCode(
  tx: Prisma.TransactionClient,
  tenantId: string,
  workspaceId: string,
  code: string,
): Promise<EngagementBadgeDefinitionRow | null> {
  const row = await tx.engagementBadgeDefinition.findUnique({
    where: {
      tenantId_workspaceId_code: { tenantId, workspaceId, code },
    },
  });
  return row === null ? null : mapBadgeRow(row);
}

async function loadLevelByCode(
  tx: Prisma.TransactionClient,
  tenantId: string,
  workspaceId: string,
  code: string,
): Promise<EngagementLevelDefinitionRow | null> {
  const row = await tx.engagementLevelDefinition.findUnique({
    where: {
      tenantId_workspaceId_code: { tenantId, workspaceId, code },
    },
  });
  return row === null ? null : mapLevelRow(row);
}

async function loadAwardRuleById(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
): Promise<EngagementAwardRuleDefinitionRow | null> {
  const row = await tx.engagementAwardRuleDefinition.findUnique({
    where: { tenantId_id: { tenantId, id } },
  });
  return row === null ? null : mapAwardRuleRow(row);
}

export function createPrismaEngagementDefinitionsRepository() {
  return {
    async ensureSeeded(tenantId: string, workspaceId: string): Promise<void> {
      await withTenantRls(tenantId, async (tx) => {
        const existingCount = await tx.engagementBadgeDefinition.count({
          where: { tenantId, workspaceId },
        });
        if (existingCount > 0) {
          return;
        }

        for (const badge of DEFAULT_ENGAGEMENT_BADGES) {
          const i18n = { en: badge.labelKey, fa: badge.labelKey };
          await tx.engagementBadgeDefinition.create({
            data: {
              tenantId,
              workspaceId,
              code: badge.code,
              titleI18n: toI18nJson(i18n),
              descriptionI18n: toI18nJson({ en: badge.descriptionKey, fa: badge.descriptionKey }),
              iconKey: "mountain",
              status: "active",
              triggerKind: badge.trigger.kind,
              triggerEventType:
                badge.trigger.kind === "event" ? badge.trigger.eventType : null,
              triggerMinPoints:
                badge.trigger.kind === "points_threshold" ? badge.trigger.minPoints : null,
            },
          });
        }

        for (const [index, level] of DEFAULT_ENGAGEMENT_LEVELS.entries()) {
          const i18n = { en: level.labelKey, fa: level.labelKey };
          await tx.engagementLevelDefinition.create({
            data: {
              tenantId,
              workspaceId,
              code: level.code,
              titleI18n: toI18nJson(i18n),
              descriptionI18n: toI18nJson(i18n),
              minPoints: level.minPoints,
              sortOrder: index,
              status: "active",
            },
          });
        }

        for (const rule of DEFAULT_ENGAGEMENT_AWARD_RULES) {
          await tx.engagementAwardRuleDefinition.create({
            data: {
              tenantId,
              workspaceId,
              eventType: rule.eventType,
              sourceModule: rule.sourceModule,
              points: rule.points,
              status: "active",
              version: 1,
              dedupePolicy: "per_user",
            },
          });
        }
      });
    },

    async listBadges(
      tenantId: string,
      workspaceId: string,
      includeArchived = false,
    ): Promise<EngagementBadgeDefinitionRow[]> {
      return withTenantRls(tenantId, async (tx) => {
        const rows = await tx.engagementBadgeDefinition.findMany({
          where: {
            tenantId,
            workspaceId,
            ...(includeArchived ? {} : { status: { not: "archived" } }),
          },
          orderBy: [{ code: "asc" }],
        });
        return rows.map(mapBadgeRow);
      });
    },

    async createBadge(
      tenantId: string,
      workspaceId: string,
      input: {
        readonly code: string;
        readonly titleI18n: EngagementI18nText;
        readonly descriptionI18n: EngagementI18nText;
        readonly iconKey: string;
        readonly triggerKind: "event" | "points_threshold";
        readonly triggerEventType?: string | null;
        readonly triggerMinPoints?: number | null;
        readonly status?: EngagementDefinitionStatus;
      },
    ): Promise<EngagementBadgeDefinitionRow> {
      if (!isApprovedBadgeIconKey(input.iconKey)) {
        throw new Error("ENGAGEMENT_BADGE_ICON_INVALID");
      }
      return withTenantRls(tenantId, async (tx) => {
        const existing = await tx.engagementBadgeDefinition.findUnique({
          where: {
            tenantId_workspaceId_code: { tenantId, workspaceId, code: input.code },
          },
        });
        if (existing !== null) {
          throwEngagementRepoError("ENGAGEMENT_BADGE_CODE_EXISTS", "badge code exists");
        }
        const row = await tx.engagementBadgeDefinition.create({
          data: {
            tenantId,
            workspaceId,
            code: input.code,
            titleI18n: toI18nJson(input.titleI18n),
            descriptionI18n: toI18nJson(input.descriptionI18n),
            iconKey: input.iconKey,
            status: input.status ?? "active",
            triggerKind: input.triggerKind,
            triggerEventType: input.triggerEventType ?? null,
            triggerMinPoints: input.triggerMinPoints ?? null,
          },
        });
        return mapBadgeRow(row);
      });
    },

    async updateBadge(
      tenantId: string,
      workspaceId: string,
      code: string,
      patch: Partial<{
        readonly titleI18n: EngagementI18nText;
        readonly descriptionI18n: EngagementI18nText;
        readonly iconKey: string;
        readonly status: EngagementDefinitionStatus;
        readonly triggerKind: "event" | "points_threshold";
        readonly triggerEventType: string | null;
        readonly triggerMinPoints: number | null;
      }>,
      expectedRowVersion: number,
    ): Promise<EngagementBadgeDefinitionRow> {
      if (patch.iconKey !== undefined && !isApprovedBadgeIconKey(patch.iconKey)) {
        throw new Error("ENGAGEMENT_BADGE_ICON_INVALID");
      }
      return withTenantRls(tenantId, async (tx) => {
        const current = await loadBadgeByCode(tx, tenantId, workspaceId, code);
        if (current === null) {
          throw new Error("ENGAGEMENT_BADGE_NOT_FOUND");
        }
        if (current.rowVersion !== expectedRowVersion) {
          throwEngagementRepoError("ENGAGEMENT_ROW_VERSION_CONFLICT", "row version conflict");
        }

        const nextStatus = patch.status ?? current.status;
        const data: Prisma.EngagementBadgeDefinitionUpdateManyMutationInput = {
          rowVersion: expectedRowVersion + 1,
          ...(patch.titleI18n !== undefined
            ? { titleI18n: toI18nJson(patch.titleI18n) }
            : {}),
          ...(patch.descriptionI18n !== undefined
            ? { descriptionI18n: toI18nJson(patch.descriptionI18n) }
            : {}),
          ...(patch.iconKey !== undefined ? { iconKey: patch.iconKey } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.triggerKind !== undefined ? { triggerKind: patch.triggerKind } : {}),
          ...(patch.triggerEventType !== undefined
            ? { triggerEventType: patch.triggerEventType }
            : {}),
          ...(patch.triggerMinPoints !== undefined
            ? { triggerMinPoints: patch.triggerMinPoints }
            : {}),
          ...(nextStatus === "archived" ? { archivedAt: new Date() } : {}),
        };

        const result = await tx.engagementBadgeDefinition.updateMany({
          where: {
            tenantId,
            workspaceId,
            code,
            rowVersion: expectedRowVersion,
          },
          data,
        });
        if (result.count !== 1) {
          throwEngagementRepoError("ENGAGEMENT_ROW_VERSION_CONFLICT", "row version conflict");
        }

        const updated = await loadBadgeByCode(tx, tenantId, workspaceId, code);
        if (updated === null) {
          throw new Error("ENGAGEMENT_BADGE_NOT_FOUND");
        }
        return updated;
      });
    },

    async listLevels(
      tenantId: string,
      workspaceId: string,
      includeArchived = false,
    ): Promise<EngagementLevelDefinitionRow[]> {
      return withTenantRls(tenantId, async (tx) => {
        const rows = await tx.engagementLevelDefinition.findMany({
          where: {
            tenantId,
            workspaceId,
            ...(includeArchived ? {} : { status: { not: "archived" } }),
          },
          orderBy: [{ minPoints: "asc" }, { sortOrder: "asc" }],
        });
        return rows.map(mapLevelRow);
      });
    },

    async createLevel(
      tenantId: string,
      workspaceId: string,
      input: {
        readonly code: string;
        readonly titleI18n: EngagementI18nText;
        readonly descriptionI18n: EngagementI18nText;
        readonly minPoints: number;
        readonly sortOrder?: number;
        readonly status?: EngagementDefinitionStatus;
      },
    ): Promise<EngagementLevelDefinitionRow> {
      const status = input.status ?? "active";
      return withTenantRls(tenantId, async (tx) => {
        if (status === "active") {
          await assertLevelThresholdAvailable(tx, tenantId, workspaceId, input.minPoints);
        }
        const row = await tx.engagementLevelDefinition.create({
          data: {
            tenantId,
            workspaceId,
            code: input.code,
            titleI18n: toI18nJson(input.titleI18n),
            descriptionI18n: toI18nJson(input.descriptionI18n),
            minPoints: input.minPoints,
            sortOrder: input.sortOrder ?? 0,
            status,
          },
        });
        return mapLevelRow(row);
      });
    },

    async updateLevel(
      tenantId: string,
      workspaceId: string,
      code: string,
      patch: Partial<{
        readonly titleI18n: EngagementI18nText;
        readonly descriptionI18n: EngagementI18nText;
        readonly minPoints: number;
        readonly sortOrder: number;
        readonly status: EngagementDefinitionStatus;
      }>,
      expectedRowVersion: number,
    ): Promise<EngagementLevelDefinitionRow> {
      return withTenantRls(tenantId, async (tx) => {
        const current = await loadLevelByCode(tx, tenantId, workspaceId, code);
        if (current === null) {
          throw new Error("ENGAGEMENT_LEVEL_NOT_FOUND");
        }
        if (current.rowVersion !== expectedRowVersion) {
          throwEngagementRepoError("ENGAGEMENT_ROW_VERSION_CONFLICT", "row version conflict");
        }

        const nextStatus = patch.status ?? current.status;
        const nextMinPoints = patch.minPoints ?? current.minPoints;
        if (nextStatus === "active") {
          await assertLevelThresholdAvailable(
            tx,
            tenantId,
            workspaceId,
            nextMinPoints,
            code,
          );
        }

        const result = await tx.engagementLevelDefinition.updateMany({
          where: {
            tenantId,
            workspaceId,
            code,
            rowVersion: expectedRowVersion,
          },
          data: {
            rowVersion: expectedRowVersion + 1,
            ...(patch.titleI18n !== undefined
              ? { titleI18n: toI18nJson(patch.titleI18n) }
              : {}),
            ...(patch.descriptionI18n !== undefined
              ? { descriptionI18n: toI18nJson(patch.descriptionI18n) }
              : {}),
            ...(patch.minPoints !== undefined ? { minPoints: patch.minPoints } : {}),
            ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
          },
        });
        if (result.count !== 1) {
          throwEngagementRepoError("ENGAGEMENT_ROW_VERSION_CONFLICT", "row version conflict");
        }

        const updated = await loadLevelByCode(tx, tenantId, workspaceId, code);
        if (updated === null) {
          throw new Error("ENGAGEMENT_LEVEL_NOT_FOUND");
        }
        return updated;
      });
    },

    async listAwardRules(
      tenantId: string,
      workspaceId: string,
      includeInactive = false,
    ): Promise<EngagementAwardRuleDefinitionRow[]> {
      return withTenantRls(tenantId, async (tx) => {
        const rows = await tx.engagementAwardRuleDefinition.findMany({
          where: {
            tenantId,
            workspaceId,
            ...(includeInactive ? {} : { status: "active" }),
          },
          orderBy: [{ eventType: "asc" }, { version: "desc" }],
        });
        return rows.map(mapAwardRuleRow);
      });
    },

    async createAwardRule(
      tenantId: string,
      workspaceId: string,
      input: {
        readonly eventType: string;
        readonly sourceModule: string;
        readonly points: number;
        readonly badgeCode?: string | null;
        readonly dedupePolicy?: EngagementDedupePolicy;
        readonly effectiveFrom?: Date;
        readonly status?: EngagementDefinitionStatus;
      },
    ): Promise<EngagementAwardRuleDefinitionRow> {
      const status = input.status ?? "active";
      const effectiveFrom = input.effectiveFrom ?? new Date();
      return withTenantRls(tenantId, async (tx) => {
        await assertActiveBadgeRef(tx, tenantId, workspaceId, input.badgeCode);

        const latest = await tx.engagementAwardRuleDefinition.findFirst({
          where: { tenantId, workspaceId, eventType: input.eventType },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const version = (latest?.version ?? 0) + 1;

        if (status === "active") {
          await closePriorActiveAwardRules(
            tx,
            tenantId,
            workspaceId,
            input.eventType,
            effectiveFrom,
          );
        }

        const row = await tx.engagementAwardRuleDefinition.create({
          data: {
            tenantId,
            workspaceId,
            eventType: input.eventType,
            sourceModule: input.sourceModule,
            points: input.points,
            badgeCode: input.badgeCode ?? null,
            status,
            effectiveFrom,
            dedupePolicy: input.dedupePolicy ?? "per_user",
            version,
          },
        });
        return mapAwardRuleRow(row);
      });
    },

    async updateAwardRule(
      tenantId: string,
      workspaceId: string,
      id: string,
      patch: Partial<{
        readonly sourceModule: string;
        readonly points: number;
        readonly badgeCode: string | null;
        readonly status: EngagementDefinitionStatus;
        readonly effectiveFrom: Date;
        readonly effectiveTo: Date | null;
        readonly dedupePolicy: EngagementDedupePolicy;
      }>,
      expectedRowVersion: number,
    ): Promise<EngagementAwardRuleDefinitionRow> {
      return withTenantRls(tenantId, async (tx) => {
        const current = await loadAwardRuleById(tx, tenantId, id);
        if (current === null) {
          throw new Error("ENGAGEMENT_AWARD_RULE_NOT_FOUND");
        }
        if (current.rowVersion !== expectedRowVersion) {
          throwEngagementRepoError("ENGAGEMENT_ROW_VERSION_CONFLICT", "row version conflict");
        }

        const nextBadgeCode =
          patch.badgeCode !== undefined ? patch.badgeCode : current.badgeCode;
        await assertActiveBadgeRef(tx, tenantId, workspaceId, nextBadgeCode);

        const nextStatus = patch.status ?? current.status;
        const nextEffectiveFrom = patch.effectiveFrom ?? current.effectiveFrom;
        if (nextStatus === "active" && current.status !== "active") {
          await closePriorActiveAwardRules(
            tx,
            tenantId,
            workspaceId,
            current.eventType,
            nextEffectiveFrom,
            id,
          );
        }

        const result = await tx.engagementAwardRuleDefinition.updateMany({
          where: {
            tenantId,
            id,
            rowVersion: expectedRowVersion,
          },
          data: {
            rowVersion: expectedRowVersion + 1,
            ...(patch.sourceModule !== undefined ? { sourceModule: patch.sourceModule } : {}),
            ...(patch.points !== undefined ? { points: patch.points } : {}),
            ...(patch.badgeCode !== undefined ? { badgeCode: patch.badgeCode } : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.effectiveFrom !== undefined ? { effectiveFrom: patch.effectiveFrom } : {}),
            ...(patch.effectiveTo !== undefined ? { effectiveTo: patch.effectiveTo } : {}),
            ...(patch.dedupePolicy !== undefined ? { dedupePolicy: patch.dedupePolicy } : {}),
          },
        });
        if (result.count !== 1) {
          throwEngagementRepoError("ENGAGEMENT_ROW_VERSION_CONFLICT", "row version conflict");
        }

        const updated = await loadAwardRuleById(tx, tenantId, id);
        if (updated === null) {
          throw new Error("ENGAGEMENT_AWARD_RULE_NOT_FOUND");
        }
        return updated;
      });
    },

    async resolveActiveAwardRule(
      tenantId: string,
      workspaceId: string,
      eventType: string,
      at: Date = new Date(),
    ): Promise<EngagementAwardRuleDefinitionRow | null> {
      return withTenantRls(tenantId, async (tx) => {
        const rows = await tx.engagementAwardRuleDefinition.findMany({
          where: {
            tenantId,
            workspaceId,
            eventType,
            status: "active",
            effectiveFrom: { lte: at },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
          },
          orderBy: { version: "desc" },
          take: 1,
        });
        const row = rows[0];
        return row === undefined ? null : mapAwardRuleRow(row);
      });
    },

    async listActiveBadgesForAward(
      tenantId: string,
      workspaceId: string,
    ): Promise<EngagementBadgeDefinitionRow[]> {
      return withTenantRls(tenantId, async (tx) => {
        const rows = await tx.engagementBadgeDefinition.findMany({
          where: { tenantId, workspaceId, status: "active" },
          orderBy: { code: "asc" },
        });
        return rows.map(mapBadgeRow);
      });
    },

    async listActiveLevels(
      tenantId: string,
      workspaceId: string,
    ): Promise<EngagementLevelDefinitionRow[]> {
      return withTenantRls(tenantId, async (tx) => {
        const rows = await tx.engagementLevelDefinition.findMany({
          where: { tenantId, workspaceId, status: "active" },
          orderBy: { minPoints: "asc" },
        });
        return rows.map(mapLevelRow);
      });
    },

    async appendAuditLog(input: {
      readonly tenantId: string;
      readonly workspaceId: string;
      readonly entityType: EngagementDefinitionAuditRow["entityType"];
      readonly entityId: string;
      readonly action: string;
      readonly actorUserId: string;
      readonly actorRole: string;
      readonly beforeJson: unknown;
      readonly afterJson: unknown;
    }): Promise<EngagementDefinitionAuditRow> {
      return withTenantRls(input.tenantId, async (tx) => {
        const row = await tx.engagementDefinitionAuditLog.create({
          data: {
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            entityType: input.entityType,
            entityId: input.entityId,
            action: input.action,
            actorUserId: input.actorUserId,
            actorRole: input.actorRole,
            beforeJson:
              input.beforeJson === undefined || input.beforeJson === null
                ? Prisma.JsonNull
                : (input.beforeJson as Prisma.InputJsonValue),
            afterJson:
              input.afterJson === undefined || input.afterJson === null
                ? Prisma.JsonNull
                : (input.afterJson as Prisma.InputJsonValue),
          },
        });
        return mapAuditRow(row);
      });
    },

    async listAuditLog(
      tenantId: string,
      workspaceId: string,
      limit: number,
    ): Promise<EngagementDefinitionAuditRow[]> {
      return withTenantRls(tenantId, async (tx) => {
        const rows = await tx.engagementDefinitionAuditLog.findMany({
          where: { tenantId, workspaceId },
          orderBy: { createdAt: "desc" },
          take: limit,
        });
        return rows.map(mapAuditRow);
      });
    },
  };
}
