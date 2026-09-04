import type {
  CreateAwardRuleBody,
  CreateBadgeBody,
  CreateLevelBody,
  EngagementAwardRuleDefinitionHttpItem,
  EngagementBadgeDefinitionHttpItem,
  EngagementDefinitionAuditListHttpResponse,
  EngagementLevelDefinitionHttpItem,
  EngagementOperatorCatalogHttpResponse,
  UpdateAwardRuleBody,
  UpdateBadgeBody,
  UpdateLevelBody,
} from "@app-tour/engagement-http-contracts";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import {
  ENGAGEMENT_BADGE_ICON_KEYS,
  ENGAGEMENT_SUPPORTED_AWARD_EVENTS,
  isSupportedAwardEventType,
  resolveSupportedSourceModule,
} from "./engagement-admin-catalog";
import type { EngagementBadgeDefinitionRow } from "./engagement-definition.types";
import {
  badgeDescriptionKey,
  badgeLabelKey,
  levelLabelKey,
  mapAuditToHttp,
  mapAwardRuleToHttp,
  mapBadgeToHttp,
  mapLevelToHttp,
} from "./engagement-definition-mappers";
import { createPrismaEngagementDefinitionsRepository } from "./infrastructure/prisma-engagement-definitions.repository";

export function requireOperatorRead(auth: TenantAuthContext): void {
  if (auth.role !== "owner" && auth.role !== "admin" && auth.role !== "viewer") {
    throw new Error("FORBIDDEN_ENGAGEMENT_OPERATOR");
  }
}

export function requireOperatorMutate(auth: TenantAuthContext): void {
  if (auth.role !== "owner" && auth.role !== "admin") {
    throw new Error("FORBIDDEN_ENGAGEMENT_OPERATOR");
  }
}

export function createEngagementAdminOperations(resolveWorkspaceId: (tenantId: string) => Promise<string>) {
  const definitionsRepository = createPrismaEngagementDefinitionsRepository();

  async function workspace(auth: TenantAuthContext): Promise<string> {
    return resolveWorkspaceId(auth.tenantId);
  }

  async function audit(
    auth: TenantAuthContext,
    workspaceId: string,
    entityType: "badge" | "level" | "award_rule",
    entityId: string,
    action: string,
    beforeJson: unknown,
    afterJson: unknown,
  ): Promise<void> {
    await definitionsRepository.appendAuditLog({
      tenantId: auth.tenantId,
      workspaceId,
      entityType,
      entityId,
      action,
      actorUserId: auth.userId,
      actorRole: auth.role,
      beforeJson,
      afterJson,
    });
  }

  return {
    definitionsRepository,

    async listOperatorBadges(auth: TenantAuthContext) {
      requireOperatorRead(auth);
      const workspaceId = await workspace(auth);
      await definitionsRepository.ensureSeeded(auth.tenantId, workspaceId);
      const items = await definitionsRepository.listBadges(auth.tenantId, workspaceId, true);
      return { items: items.map(mapBadgeToHttp) };
    },

    async createOperatorBadge(
      auth: TenantAuthContext,
      input: CreateBadgeBody,
    ): Promise<EngagementBadgeDefinitionHttpItem> {
      requireOperatorMutate(auth);
      const workspaceId = await workspace(auth);
      if (
        input.triggerKind === "event" &&
        (input.triggerEventType === undefined ||
          !isSupportedAwardEventType(input.triggerEventType))
      ) {
        throw new Error("ENGAGEMENT_BADGE_TRIGGER_INVALID");
      }
      const created = await definitionsRepository.createBadge(auth.tenantId, workspaceId, {
        code: input.code,
        titleI18n: input.titleI18n,
        descriptionI18n: input.descriptionI18n,
        iconKey: input.iconKey,
        triggerKind: input.triggerKind,
        triggerEventType: input.triggerEventType ?? null,
        triggerMinPoints: input.triggerMinPoints ?? null,
        status: input.status ?? "inactive",
      });
      await audit(auth, workspaceId, "badge", created.id, "create", null, created);
      return mapBadgeToHttp(created);
    },

    async updateOperatorBadge(
      auth: TenantAuthContext,
      code: string,
      input: UpdateBadgeBody,
    ): Promise<EngagementBadgeDefinitionHttpItem> {
      requireOperatorMutate(auth);
      const workspaceId = await workspace(auth);
      const before = (await definitionsRepository.listBadges(auth.tenantId, workspaceId, true)).find(
        (row) => row.code === code,
      );
      const updated = await definitionsRepository.updateBadge(
        auth.tenantId,
        workspaceId,
        code,
        {
          ...(input.titleI18n !== undefined ? { titleI18n: input.titleI18n } : {}),
          ...(input.descriptionI18n !== undefined ? { descriptionI18n: input.descriptionI18n } : {}),
          ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
          ...(input.triggerKind !== undefined ? { triggerKind: input.triggerKind } : {}),
          ...(input.triggerEventType !== undefined
            ? { triggerEventType: input.triggerEventType }
            : {}),
          ...(input.triggerMinPoints !== undefined
            ? { triggerMinPoints: input.triggerMinPoints }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
        input.rowVersion,
      );
      await audit(auth, workspaceId, "badge", updated.id, "update", before ?? null, updated);
      return mapBadgeToHttp(updated);
    },

    async listOperatorLevels(auth: TenantAuthContext) {
      requireOperatorRead(auth);
      const workspaceId = await workspace(auth);
      await definitionsRepository.ensureSeeded(auth.tenantId, workspaceId);
      const items = await definitionsRepository.listLevels(auth.tenantId, workspaceId);
      return { items: items.map(mapLevelToHttp) };
    },

    async createOperatorLevel(
      auth: TenantAuthContext,
      input: CreateLevelBody,
    ): Promise<EngagementLevelDefinitionHttpItem> {
      requireOperatorMutate(auth);
      const workspaceId = await workspace(auth);
      const created = await definitionsRepository.createLevel(auth.tenantId, workspaceId, {
        code: input.code,
        titleI18n: input.titleI18n,
        descriptionI18n: input.descriptionI18n,
        minPoints: input.minPoints,
        sortOrder: input.sortOrder,
        status: input.status ?? "inactive",
      });
      await audit(auth, workspaceId, "level", created.id, "create", null, created);
      return mapLevelToHttp(created);
    },

    async updateOperatorLevel(
      auth: TenantAuthContext,
      code: string,
      input: UpdateLevelBody,
    ): Promise<EngagementLevelDefinitionHttpItem> {
      requireOperatorMutate(auth);
      const workspaceId = await workspace(auth);
      const before = (await definitionsRepository.listLevels(auth.tenantId, workspaceId)).find(
        (row) => row.code === code,
      );
      const updated = await definitionsRepository.updateLevel(
        auth.tenantId,
        workspaceId,
        code,
        {
          ...(input.titleI18n !== undefined ? { titleI18n: input.titleI18n } : {}),
          ...(input.descriptionI18n !== undefined ? { descriptionI18n: input.descriptionI18n } : {}),
          ...(input.minPoints !== undefined ? { minPoints: input.minPoints } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
        input.rowVersion,
      );
      await audit(auth, workspaceId, "level", updated.id, "update", before ?? null, updated);
      return mapLevelToHttp(updated);
    },

    async listOperatorAwardRules(auth: TenantAuthContext) {
      requireOperatorRead(auth);
      const workspaceId = await workspace(auth);
      await definitionsRepository.ensureSeeded(auth.tenantId, workspaceId);
      const items = await definitionsRepository.listAwardRules(auth.tenantId, workspaceId, true);
      return { items: items.map(mapAwardRuleToHttp) };
    },

    async createOperatorAwardRule(
      auth: TenantAuthContext,
      input: CreateAwardRuleBody,
    ): Promise<EngagementAwardRuleDefinitionHttpItem> {
      requireOperatorMutate(auth);
      if (!isSupportedAwardEventType(input.eventType)) {
        throw new Error("ENGAGEMENT_AWARD_EVENT_UNSUPPORTED");
      }
      const sourceModule = resolveSupportedSourceModule(input.eventType);
      if (sourceModule === undefined) {
        throw new Error("ENGAGEMENT_AWARD_EVENT_UNSUPPORTED");
      }
      const workspaceId = await workspace(auth);
      const created = await definitionsRepository.createAwardRule(auth.tenantId, workspaceId, {
        eventType: input.eventType,
        sourceModule,
        points: input.points,
        badgeCode: input.badgeCode ?? null,
        dedupePolicy: input.dedupePolicy ?? "per_user",
        status: input.status ?? "inactive",
      });
      await audit(auth, workspaceId, "award_rule", created.id, "create", null, created);
      return mapAwardRuleToHttp(created);
    },

    async updateOperatorAwardRule(
      auth: TenantAuthContext,
      ruleId: string,
      input: UpdateAwardRuleBody,
    ): Promise<EngagementAwardRuleDefinitionHttpItem> {
      requireOperatorMutate(auth);
      const workspaceId = await workspace(auth);
      const beforeList = await definitionsRepository.listAwardRules(auth.tenantId, workspaceId, true);
      const before = beforeList.find((row) => row.id === ruleId) ?? null;
      const updated = await definitionsRepository.updateAwardRule(
        auth.tenantId,
        workspaceId,
        ruleId,
        {
          ...(input.points !== undefined ? { points: input.points } : {}),
          ...(input.badgeCode !== undefined ? { badgeCode: input.badgeCode } : {}),
          ...(input.dedupePolicy !== undefined ? { dedupePolicy: input.dedupePolicy } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.effectiveFrom !== undefined
            ? { effectiveFrom: new Date(input.effectiveFrom) }
            : {}),
          ...(input.effectiveTo !== undefined
            ? { effectiveTo: input.effectiveTo === null ? null : new Date(input.effectiveTo) }
            : {}),
        },
        input.rowVersion,
      );
      await audit(auth, workspaceId, "award_rule", updated.id, "update", before, updated);
      return mapAwardRuleToHttp(updated);
    },

    async listOperatorAuditLog(
      auth: TenantAuthContext,
      limit: number,
    ): Promise<EngagementDefinitionAuditListHttpResponse> {
      requireOperatorRead(auth);
      const workspaceId = await workspace(auth);
      const items = await definitionsRepository.listAuditLog(auth.tenantId, workspaceId, limit);
      return { items: items.map(mapAuditToHttp) };
    },

    async getOperatorCatalog(_auth: TenantAuthContext): Promise<EngagementOperatorCatalogHttpResponse> {
      requireOperatorRead(_auth);
      return {
        icons: ENGAGEMENT_BADGE_ICON_KEYS.map((key) => ({
          key,
          labelKey: `engagement.icons.${key}`,
        })),
        supportedEvents: ENGAGEMENT_SUPPORTED_AWARD_EVENTS.map((entry) => ({
          eventType: entry.eventType,
          sourceModule: entry.sourceModule,
          labelKey: entry.labelKey,
        })),
      };
    },

    mapBadgeProgress(
      badge: EngagementBadgeDefinitionRow,
      earnedAt: string | null,
      totalPoints: number,
    ) {
      let progressPercent: number | null = null;
      if (!earnedAt && badge.triggerKind === "points_threshold") {
        progressPercent = Math.min(
          100,
          Math.round((totalPoints / (badge.triggerMinPoints ?? 1)) * 100),
        );
      }
      return {
        code: badge.code,
        labelKey: badgeLabelKey(badge.code),
        descriptionKey: badgeDescriptionKey(badge.code),
        earned: earnedAt !== null,
        earnedAt,
        progressPercent,
      };
    },

    levelLabelKey,
  };
}
