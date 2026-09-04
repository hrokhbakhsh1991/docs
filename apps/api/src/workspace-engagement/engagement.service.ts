import type { EngagementServicePort } from "@app-tour/engagement-http";
import type {
  EngagementMemberLookupHttpResponse,
  EngagementMemberSummaryHttpResponse,
  EngagementOperatorOverviewHttpResponse,
  EngagementPointHistoryHttpResponse,
  EngagementReversalHttpResponse,
} from "@app-tour/engagement-http-contracts";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import {
  DEFAULT_ENGAGEMENT_BADGES,
  DEFAULT_ENGAGEMENT_LEVELS,
  resolveNextLevel,
  type EngagementBadgeDefinition,
} from "./engagement-policy";
import { assertEngagementWorkspaceGate } from "./engagement-module-enabled";
import {
  createPrismaEngagementRepository,
  findBadgeDefinition,
} from "./infrastructure/prisma-engagement.repository";

function requireWorkspaceId(auth: TenantAuthContext): string {
  const workspaceId = auth.workspaceId?.trim();
  if (workspaceId === undefined || workspaceId.length === 0) {
    throw new Error("ENGAGEMENT_OWNERSHIP_MISMATCH");
  }
  return workspaceId;
}

function requireOperator(auth: TenantAuthContext): void {
  if (auth.role !== "OWNER" && auth.role !== "OPERATOR" && auth.role !== "ADMIN") {
    throw new Error("FORBIDDEN_ENGAGEMENT_OPERATOR");
  }
}

function mapBadgeProgress(
  badge: EngagementBadgeDefinition,
  earnedAt: string | null,
  totalPoints: number,
): EngagementMemberSummaryHttpResponse["badges"][number] {
  let progressPercent: number | null = null;
  if (!earnedAt && badge.trigger.kind === "points_threshold") {
    progressPercent = Math.min(100, Math.round((totalPoints / badge.trigger.minPoints) * 100));
  }
  return {
    code: badge.code,
    labelKey: badge.labelKey,
    descriptionKey: badge.descriptionKey,
    earned: earnedAt !== null,
    earnedAt,
    progressPercent,
  };
}

function buildSummary(input: {
  readonly totalPoints: number;
  readonly currentLevelCode: string;
  readonly earnedBadges: ReadonlyMap<string, string>;
  readonly recentEvents: EngagementMemberSummaryHttpResponse["recentPointEvents"];
}): EngagementMemberSummaryHttpResponse {
  const currentLevel =
    DEFAULT_ENGAGEMENT_LEVELS.find((level) => level.code === input.currentLevelCode) ??
    DEFAULT_ENGAGEMENT_LEVELS[0]!;
  const nextLevel = resolveNextLevel(input.totalPoints);
  return {
    totalPoints: input.totalPoints,
    currentLevelCode: currentLevel.code,
    currentLevelLabelKey: currentLevel.labelKey,
    nextLevelCode: nextLevel?.code ?? null,
    nextLevelLabelKey: nextLevel?.labelKey ?? null,
    pointsToNextLevel:
      nextLevel !== null ? Math.max(0, nextLevel.minPoints - input.totalPoints) : null,
    earnedBadgeCount: input.earnedBadges.size,
    badges: DEFAULT_ENGAGEMENT_BADGES.map((badge) =>
      mapBadgeProgress(badge, input.earnedBadges.get(badge.code) ?? null, input.totalPoints),
    ),
    recentPointEvents: input.recentEvents,
  };
}

export function createEngagementService(): EngagementServicePort {
  const repository = createPrismaEngagementRepository();

  return {
    async getMemberSummary(auth) {
      await assertEngagementWorkspaceGate(auth.tenantId);
      const workspaceId = requireWorkspaceId(auth);
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
      return buildSummary({
        totalPoints: profile.totalPoints,
        currentLevelCode: profile.currentLevelCode,
        earnedBadges: earnedMap,
        recentEvents: events.items.map((event) => ({
          id: event.id,
          pointsDelta: event.pointsDelta,
          sourceModule: event.sourceModule,
          sourceEventType: event.sourceEventType,
          sourceEntityId: event.sourceEntityId,
          reason: event.reason,
          createdAt: event.createdAt.toISOString(),
        })),
      });
    },

    async getMemberPointHistory(auth, query) {
      await assertEngagementWorkspaceGate(auth.tenantId);
      const workspaceId = requireWorkspaceId(auth);
      const page = await repository.listPointEventsForUser({
        tenantId: auth.tenantId,
        userId: auth.userId,
        workspaceId,
        limit: query.limit,
        ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
      });
      return {
        items: page.items.map((event) => ({
          id: event.id,
          pointsDelta: event.pointsDelta,
          sourceModule: event.sourceModule,
          sourceEventType: event.sourceEventType,
          sourceEntityId: event.sourceEntityId,
          reason: event.reason,
          createdAt: event.createdAt.toISOString(),
        })),
        hasMore: page.hasMore,
        nextCursor: page.nextCursor,
      };
    },

    async getMemberBadges(auth) {
      const summary = await this.getMemberSummary(auth);
      return summary.badges;
    },

    async getOperatorOverview(auth) {
      await assertEngagementWorkspaceGate(auth.tenantId);
      requireOperator(auth);
      const workspaceId = requireWorkspaceId(auth);
      const [events, badges] = await Promise.all([
        repository.listRecentPointEventsForWorkspace(auth.tenantId, workspaceId, 20),
        repository.listRecentBadgesForWorkspace(auth.tenantId, workspaceId, 20),
      ]);
      return {
        recentPointEvents: events.map((event) => ({
          id: event.id,
          userId: event.userId,
          pointsDelta: event.pointsDelta,
          sourceModule: event.sourceModule,
          sourceEventType: event.sourceEventType,
          sourceEntityId: event.sourceEntityId,
          reason: event.reason,
          createdAt: event.createdAt.toISOString(),
          displayHint: null,
        })),
        recentBadges: badges.map((badge) => ({
          userId: badge.userId,
          badgeCode: badge.badgeCode,
          labelKey: findBadgeDefinition(badge.badgeCode)?.labelKey ?? badge.badgeCode,
          earnedAt: badge.earnedAt.toISOString(),
          displayHint: null,
        })),
      } satisfies EngagementOperatorOverviewHttpResponse;
    },

    async getOperatorMemberLookup(auth, userId) {
      await assertEngagementWorkspaceGate(auth.tenantId);
      requireOperator(auth);
      const workspaceId = requireWorkspaceId(auth);
      const profile = await repository.getOrCreateProfile(auth.tenantId, workspaceId, userId);
      const badges = await repository.listBadgesForUser(auth.tenantId, userId, workspaceId);
      const events = await repository.listPointEventsForUser({
        tenantId: auth.tenantId,
        userId,
        workspaceId,
        limit: 10,
      });
      const earnedMap = new Map(
        badges.map((badge) => [badge.badgeCode, badge.earnedAt.toISOString()] as const),
      );
      return {
        userId,
        summary: buildSummary({
          totalPoints: profile.totalPoints,
          currentLevelCode: profile.currentLevelCode,
          earnedBadges: earnedMap,
          recentEvents: events.items.map((event) => ({
            id: event.id,
            pointsDelta: event.pointsDelta,
            sourceModule: event.sourceModule,
            sourceEventType: event.sourceEventType,
            sourceEntityId: event.sourceEntityId,
            reason: event.reason,
            createdAt: event.createdAt.toISOString(),
          })),
        }),
      } satisfies EngagementMemberLookupHttpResponse;
    },

    async reversePointEvent(auth, userId, input) {
      await assertEngagementWorkspaceGate(auth.tenantId);
      requireOperator(auth);
      const workspaceId = requireWorkspaceId(auth);
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
  };
}

export type EngagementService = ReturnType<typeof createEngagementService>;
