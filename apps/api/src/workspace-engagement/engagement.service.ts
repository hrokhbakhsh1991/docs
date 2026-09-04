import type { EngagementServicePort } from "@app-tour/engagement-http";
import type {
  EngagementMemberLookupHttpResponse,
  EngagementMemberSummaryHttpResponse,
  EngagementOperatorMemberSummaryHttpResponse,
  EngagementOperatorOverviewHttpResponse,
  EngagementOperatorPolicyHttpResponse,
  EngagementAdjustmentHttpResponse,
  EngagementPointEventHttpItem,
  EngagementReversalHttpResponse,
} from "@app-tour/engagement-http-contracts";
import {
  projectMemberDisplayPoints,
  projectMemberPointEvents,
  toOperatorPointEventHttpItem,
} from "@app-tour/engagement-http-contracts";

import { resolveNextLevel } from "./engagement-policy";
import { createEngagementAdminOperations, requireOperatorMutate, requireOperatorRead } from "./engagement-admin-operations";
import {
  badgeDescriptionKey,
  badgeLabelKey,
  levelLabelKey,
} from "./engagement-definition-mappers";
import { assertEngagementWorkspaceGate } from "./engagement-module-enabled";
import { findBadgeDefinitionFromRows } from "./infrastructure/prisma-engagement-definitions.repository";
import { createPrismaEngagementRepository } from "./infrastructure/prisma-engagement.repository";
import { notifyEngagementBadgeEarned } from "./process-engagement-awards";

async function resolveEngagementWorkspaceId(tenantId: string): Promise<string> {
  const gate = await assertEngagementWorkspaceGate(tenantId);
  return gate.workspaceType;
}

function mapRepositoryPointEvent(event: {
  readonly id: string;
  readonly pointsDelta: number;
  readonly sourceModule: string;
  readonly sourceEventType: string;
  readonly sourceEntityId: string | null;
  readonly reason: string | null;
  readonly actorRole: string | null;
  readonly createdAt: Date;
}): EngagementPointEventHttpItem {
  return toOperatorPointEventHttpItem({
    id: event.id,
    pointsDelta: event.pointsDelta,
    sourceModule: event.sourceModule,
    sourceEventType: event.sourceEventType,
    sourceEntityId: event.sourceEntityId,
    reason: event.reason,
    actorRole: event.actorRole,
    createdAt: event.createdAt.toISOString(),
  });
}

function buildMemberSummary(input: {
  readonly totalPoints: number;
  readonly currentLevelCode: string;
  readonly earnedBadges: ReadonlyMap<string, string>;
  readonly recentEvents: readonly EngagementPointEventHttpItem[];
  readonly adminOps: ReturnType<typeof createEngagementAdminOperations>;
  readonly activeBadges: Awaited<
    ReturnType<
      ReturnType<typeof createEngagementAdminOperations>["definitionsRepository"]["listActiveBadgesForAward"]
    >
  >;
  readonly activeLevels: Awaited<
    ReturnType<
      ReturnType<typeof createEngagementAdminOperations>["definitionsRepository"]["listActiveLevels"]
    >
  >;
}): EngagementMemberSummaryHttpResponse {
  const displayPoints = projectMemberDisplayPoints(input.totalPoints);
  const levelDefs = input.activeLevels.map((level) => ({
    code: level.code,
    labelKey: levelLabelKey(level.code),
    minPoints: level.minPoints,
  }));
  const currentLevel =
    levelDefs.find((level) => level.code === input.currentLevelCode) ?? levelDefs[0]!;
  const nextLevel = resolveNextLevel(displayPoints, levelDefs);
  return {
    totalPoints: displayPoints,
    currentLevelCode: currentLevel.code,
    currentLevelLabelKey: currentLevel.labelKey,
    nextLevelCode: nextLevel?.code ?? null,
    nextLevelLabelKey: nextLevel?.labelKey ?? null,
    pointsToNextLevel:
      nextLevel !== null ? Math.max(0, nextLevel.minPoints - displayPoints) : null,
    earnedBadgeCount: input.earnedBadges.size,
    badges: input.activeBadges.map((badge) =>
      input.adminOps.mapBadgeProgress(
        badge,
        input.earnedBadges.get(badge.code) ?? null,
        displayPoints,
      ),
    ),
    recentPointEvents: projectMemberPointEvents(input.recentEvents),
  };
}

function buildOperatorMemberSummary(input: {
  readonly totalPoints: number;
  readonly currentLevelCode: string;
  readonly earnedBadges: ReadonlyMap<string, string>;
  readonly recentEvents: readonly EngagementPointEventHttpItem[];
  readonly adminOps: ReturnType<typeof createEngagementAdminOperations>;
  readonly activeBadges: Awaited<
    ReturnType<
      ReturnType<typeof createEngagementAdminOperations>["definitionsRepository"]["listActiveBadgesForAward"]
    >
  >;
  readonly activeLevels: Awaited<
    ReturnType<
      ReturnType<typeof createEngagementAdminOperations>["definitionsRepository"]["listActiveLevels"]
    >
  >;
}): EngagementOperatorMemberSummaryHttpResponse {
  const levelDefs = input.activeLevels.map((level) => ({
    code: level.code,
    labelKey: levelLabelKey(level.code),
    minPoints: level.minPoints,
  }));
  const currentLevel =
    levelDefs.find((level) => level.code === input.currentLevelCode) ?? levelDefs[0]!;
  const nextLevel = resolveNextLevel(input.totalPoints, levelDefs);
  return {
    totalPoints: input.totalPoints,
    currentLevelCode: currentLevel.code,
    currentLevelLabelKey: currentLevel.labelKey,
    nextLevelCode: nextLevel?.code ?? null,
    nextLevelLabelKey: nextLevel?.labelKey ?? null,
    pointsToNextLevel:
      nextLevel !== null ? Math.max(0, nextLevel.minPoints - input.totalPoints) : null,
    earnedBadgeCount: input.earnedBadges.size,
    badges: input.activeBadges.map((badge) =>
      input.adminOps.mapBadgeProgress(
        badge,
        input.earnedBadges.get(badge.code) ?? null,
        input.totalPoints,
      ),
    ),
    recentPointEvents: input.recentEvents,
  };
}

export function createEngagementService(): EngagementServicePort {
  const repository = createPrismaEngagementRepository();
  const adminOps = createEngagementAdminOperations(resolveEngagementWorkspaceId);

  async function loadPolicyContext(tenantId: string, workspaceId: string) {
    await adminOps.definitionsRepository.ensureSeeded(tenantId, workspaceId);
    const [activeBadges, activeLevels, awardRules] = await Promise.all([
      adminOps.definitionsRepository.listActiveBadgesForAward(tenantId, workspaceId),
      adminOps.definitionsRepository.listActiveLevels(tenantId, workspaceId),
      adminOps.definitionsRepository.listAwardRules(tenantId, workspaceId, true),
    ]);
    return { activeBadges, activeLevels, awardRules };
  }

  return {
    async getMemberSummary(auth) {
      const workspaceId = await resolveEngagementWorkspaceId(auth.tenantId);
      const { activeBadges, activeLevels } = await loadPolicyContext(auth.tenantId, workspaceId);
      const profile = await repository.getOrCreateProfile(auth.tenantId, workspaceId, auth.userId);
      const badges = await repository.listBadgesForUser(auth.tenantId, auth.userId, workspaceId);
      const events = await repository.listPointEventsForUser({
        tenantId: auth.tenantId,
        userId: auth.userId,
        workspaceId,
        limit: 5,
      });
      const earnedMap = new Map(
        badges.map((badge) => [badge.badgeCode, badge.earnedAt.toISOString()] as const),
      );
      const recentEvents = events.items.map((event) => mapRepositoryPointEvent(event));
      return buildMemberSummary({
        totalPoints: profile.totalPoints,
        currentLevelCode: profile.currentLevelCode,
        earnedBadges: earnedMap,
        recentEvents,
        adminOps,
        activeBadges,
        activeLevels,
      });
    },

    async getMemberPointHistory(auth, query) {
      const workspaceId = await resolveEngagementWorkspaceId(auth.tenantId);
      const page = await repository.listPointEventsForUser({
        tenantId: auth.tenantId,
        userId: auth.userId,
        workspaceId,
        limit: query.limit,
        ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
      });
      return {
        items: projectMemberPointEvents(page.items.map((event) => mapRepositoryPointEvent(event))),
        hasMore: page.hasMore,
        nextCursor: page.nextCursor,
      };
    },

    async getMemberBadges(auth) {
      const summary = await this.getMemberSummary(auth);
      return summary.badges;
    },

    async getOperatorOverview(auth) {
      requireOperatorRead(auth);
      const workspaceId = await resolveEngagementWorkspaceId(auth.tenantId);
      const { activeBadges } = await loadPolicyContext(auth.tenantId, workspaceId);
      const [events, badges] = await Promise.all([
        repository.listRecentPointEventsForWorkspace(auth.tenantId, workspaceId, 20),
        repository.listRecentBadgesForWorkspace(auth.tenantId, workspaceId, 20),
      ]);
      return {
        recentPointEvents: events.map((event) => ({
          ...mapRepositoryPointEvent(event),
          userId: event.userId,
          displayHint: event.actorUserId ? `actor:${event.actorRole}` : null,
        })),
        recentBadges: badges.map((badge) => {
          const definition = findBadgeDefinitionFromRows(badge.badgeCode, activeBadges);
          return {
            userId: badge.userId,
            badgeCode: badge.badgeCode,
            labelKey: definition ? badgeLabelKey(definition.code) : badge.badgeCode,
            earnedAt: badge.earnedAt.toISOString(),
            displayHint: null,
          };
        }),
      } satisfies EngagementOperatorOverviewHttpResponse;
    },

    async getOperatorPolicy(auth) {
      requireOperatorRead(auth);
      const workspaceId = await resolveEngagementWorkspaceId(auth.tenantId);
      const { activeBadges, activeLevels, awardRules } = await loadPolicyContext(
        auth.tenantId,
        workspaceId,
      );
      return {
        managementMode: "operator_managed",
        editUnavailableReasonKey: null,
        levels: activeLevels.map((level) => ({
          code: level.code,
          labelKey: levelLabelKey(level.code),
          minPoints: level.minPoints,
        })),
        badges: activeBadges.map((badge) => ({
          code: badge.code,
          labelKey: badgeLabelKey(badge.code),
          descriptionKey: badgeDescriptionKey(badge.code),
          triggerKind: badge.triggerKind,
          triggerEventType: badge.triggerEventType,
          triggerMinPoints: badge.triggerMinPoints,
        })),
        awardRules: awardRules
          .filter((rule) => rule.status === "active")
          .map((rule) => ({
            eventType: rule.eventType,
            points: rule.points,
            sourceModule: rule.sourceModule,
          })),
      } satisfies EngagementOperatorPolicyHttpResponse;
    },

    async getOperatorMemberLookup(auth, userId) {
      requireOperatorRead(auth);
      const workspaceId = await resolveEngagementWorkspaceId(auth.tenantId);
      const { activeBadges, activeLevels } = await loadPolicyContext(auth.tenantId, workspaceId);
      const profile = await repository.getOrCreateProfile(auth.tenantId, workspaceId, userId);
      const badges = await repository.listBadgesForUser(auth.tenantId, userId, workspaceId);
      const events = await repository.listPointEventsForUser({
        tenantId: auth.tenantId,
        userId,
        workspaceId,
        limit: 50,
      });
      const earnedMap = new Map(
        badges.map((badge) => [badge.badgeCode, badge.earnedAt.toISOString()] as const),
      );
      const recentEvents = events.items.map((event) => mapRepositoryPointEvent(event));
      return {
        userId,
        summary: buildOperatorMemberSummary({
          totalPoints: profile.totalPoints,
          currentLevelCode: profile.currentLevelCode,
          earnedBadges: earnedMap,
          recentEvents,
          adminOps,
          activeBadges,
          activeLevels,
        }),
      } satisfies EngagementMemberLookupHttpResponse;
    },

    async adjustMemberPoints(auth, userId, input) {
      requireOperatorMutate(auth);
      const workspaceId = await resolveEngagementWorkspaceId(auth.tenantId);
      const { activeBadges } = await loadPolicyContext(auth.tenantId, workspaceId);
      const profile = await repository.getOrCreateProfile(auth.tenantId, workspaceId, userId);
      if (profile.totalPoints + input.pointsDelta < 0) {
        throw new Error("ENGAGEMENT_ADJUSTMENT_INSUFFICIENT_POINTS");
      }
      const result = await repository.awardPoints({
        tenantId: auth.tenantId,
        workspaceId,
        userId,
        pointsDelta: input.pointsDelta,
        sourceModule: "engagement",
        sourceEventType: "engagement.points.manual_adjustment",
        sourceEntityId: input.sourceEntityId ?? null,
        dedupeKey: `engagement:manual:${input.idempotencyKey}`,
        actorUserId: auth.userId,
        actorRole: auth.role,
        reason: input.reason,
      });
      if (!result.replay && result.event !== null) {
        for (const badge of result.newBadges) {
          const definition = findBadgeDefinitionFromRows(badge.badgeCode, activeBadges);
          if (definition === undefined) {
            continue;
          }
          await notifyEngagementBadgeEarned({
            tenantId: badge.tenantId,
            userId: badge.userId,
            badgeCode: badge.badgeCode,
            dedupeKey: `engagement:notification:badge:${badge.badgeCode}:${badge.userId}`,
            titleKey: badgeLabelKey(definition.code),
            bodyKey: badgeDescriptionKey(definition.code),
            title: definition.titleI18n.en,
            body: definition.descriptionI18n.en,
          });
        }
      }
      if (result.event === null) {
        return {
          eventId: profile.id,
          totalPoints: result.profile.totalPoints,
          replay: true,
        } satisfies EngagementAdjustmentHttpResponse;
      }
      return {
        eventId: result.event.id,
        totalPoints: result.profile.totalPoints,
        replay: false,
      } satisfies EngagementAdjustmentHttpResponse;
    },

    async reversePointEvent(auth, userId, input) {
      requireOperatorMutate(auth);
      const workspaceId = await resolveEngagementWorkspaceId(auth.tenantId);
      const original = await repository.findPointEventById(auth.tenantId, input.originalEventId);
      if (original === null || original.userId !== userId) {
        throw new Error("ENGAGEMENT_EVENT_NOT_FOUND");
      }
      if (original.pointsDelta <= 0) {
        throw new Error("ENGAGEMENT_REVERSAL_INVALID");
      }
      const result = await repository.awardPoints({
        tenantId: auth.tenantId,
        workspaceId,
        userId,
        pointsDelta: -original.pointsDelta,
        sourceModule: "engagement",
        sourceEventType: "engagement.points.reversed",
        sourceEntityId: original.id,
        dedupeKey: `engagement:reversal:${input.idempotencyKey}`,
        reversesEventId: original.id,
        actorUserId: auth.userId,
        actorRole: auth.role,
        reason: input.reason,
      });
      if (result.event === null) {
        return {
          reversalEventId: original.id,
          totalPoints: result.profile.totalPoints,
          replay: true,
        } satisfies EngagementReversalHttpResponse;
      }
      return {
        reversalEventId: result.event.id,
        totalPoints: result.profile.totalPoints,
        replay: false,
      } satisfies EngagementReversalHttpResponse;
    },

    listOperatorBadges: (auth) => adminOps.listOperatorBadges(auth),
    createOperatorBadge: (auth, input) => {
      const { idempotencyKey: _ignored, ...body } = input;
      return adminOps.createOperatorBadge(auth, body);
    },
    updateOperatorBadge: (auth, code, input) => adminOps.updateOperatorBadge(auth, code, input),
    listOperatorLevels: (auth) => adminOps.listOperatorLevels(auth),
    createOperatorLevel: (auth, input) => {
      const { idempotencyKey: _ignored, ...body } = input;
      return adminOps.createOperatorLevel(auth, body);
    },
    updateOperatorLevel: (auth, code, input) => adminOps.updateOperatorLevel(auth, code, input),
    listOperatorAwardRules: (auth) => adminOps.listOperatorAwardRules(auth),
    createOperatorAwardRule: (auth, input) => {
      const { idempotencyKey: _ignored, ...body } = input;
      return adminOps.createOperatorAwardRule(auth, body);
    },
    updateOperatorAwardRule: (auth, ruleId, input) =>
      adminOps.updateOperatorAwardRule(auth, ruleId, input),
    listOperatorAuditLog: (auth, query) => adminOps.listOperatorAuditLog(auth, query.limit),
    getOperatorCatalog: (auth) => adminOps.getOperatorCatalog(auth),
  };
}

export type EngagementService = ReturnType<typeof createEngagementService>;
