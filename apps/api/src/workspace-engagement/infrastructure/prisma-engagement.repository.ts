import type { Prisma } from "@prisma/client";

import { getPrismaClient } from "../db/prisma-client";
import {
  DEFAULT_ENGAGEMENT_BADGES,
  resolveLevelForPoints,
  type EngagementBadgeDefinition,
} from "./engagement-policy";
import type {
  AwardEngagementPointsInput,
  AwardEngagementPointsResult,
  EngagementPointEventRow,
  EngagementProfileRow,
  EngagementRepository,
  MemberEngagementBadgeRow,
} from "./engagement-repository.types";

function mapProfile(row: {
  id: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  totalPoints: number;
  currentLevelCode: string;
  createdAt: Date;
  updatedAt: Date;
}): EngagementProfileRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    userId: row.userId,
    totalPoints: row.totalPoints,
    currentLevelCode: row.currentLevelCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapEvent(row: {
  id: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  profileId: string;
  pointsDelta: number;
  sourceModule: string;
  sourceEventType: string;
  sourceEntityId: string | null;
  dedupeKey: string;
  reversesEventId: string | null;
  actorUserId: string | null;
  actorRole: string | null;
  reason: string | null;
  createdAt: Date;
}): EngagementPointEventRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    userId: row.userId,
    profileId: row.profileId,
    pointsDelta: row.pointsDelta,
    sourceModule: row.sourceModule,
    sourceEventType: row.sourceEventType,
    sourceEntityId: row.sourceEntityId,
    dedupeKey: row.dedupeKey,
    reversesEventId: row.reversesEventId,
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}

function mapBadge(row: {
  id: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  profileId: string;
  badgeCode: string;
  earnedAt: Date;
  dedupeKey: string;
}): MemberEngagementBadgeRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    userId: row.userId,
    profileId: row.profileId,
    badgeCode: row.badgeCode,
    earnedAt: row.earnedAt,
    dedupeKey: row.dedupeKey,
  };
}

async function ensureBadgesForProfile(
  tx: Prisma.TransactionClient,
  profile: EngagementProfileRow,
  triggerEventType?: string,
): Promise<MemberEngagementBadgeRow[]> {
  const earned = new Map(
    (
      await tx.memberEngagementBadge.findMany({
        where: { tenantId: profile.tenantId, userId: profile.userId },
      })
    ).map((row) => [row.badgeCode, mapBadge(row)]),
  );
  const created: MemberEngagementBadgeRow[] = [];

  for (const badge of DEFAULT_ENGAGEMENT_BADGES) {
    if (earned.has(badge.code)) {
      continue;
    }
    const shouldAward =
      badge.trigger.kind === "points_threshold"
        ? profile.totalPoints >= badge.trigger.minPoints
        : triggerEventType === badge.trigger.eventType;
    if (!shouldAward) {
      continue;
    }
    const dedupeKey = `engagement:badge:${badge.code}:${profile.userId}`;
    try {
      const row = await tx.memberEngagementBadge.create({
        data: {
          tenantId: profile.tenantId,
          workspaceId: profile.workspaceId,
          userId: profile.userId,
          profileId: profile.id,
          badgeCode: badge.code,
          dedupeKey,
        },
      });
      created.push(mapBadge(row));
    } catch (error: unknown) {
      if (
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  return created;
}

export function createPrismaEngagementRepository(): EngagementRepository {
  const prisma = getPrismaClient();

  return {
    async getOrCreateProfile(tenantId, workspaceId, userId) {
      const existing = await prisma.engagementProfile.findUnique({
        where: {
          tenantId_workspaceId_userId: { tenantId, workspaceId, userId },
        },
      });
      if (existing !== null) {
        return mapProfile(existing);
      }
      const created = await prisma.engagementProfile.create({
        data: {
          tenantId,
          workspaceId,
          userId,
          totalPoints: 0,
          currentLevelCode: "base_camp",
        },
      });
      return mapProfile(created);
    },

    async awardPoints(input) {
      return prisma.$transaction(async (tx) => {
        const existingEvent = await tx.engagementPointEvent.findUnique({
          where: {
            tenantId_dedupeKey: {
              tenantId: input.tenantId,
              dedupeKey: input.dedupeKey,
            },
          },
        });
        const profile = await tx.engagementProfile.upsert({
          where: {
            tenantId_workspaceId_userId: {
              tenantId: input.tenantId,
              workspaceId: input.workspaceId,
              userId: input.userId,
            },
          },
          create: {
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            userId: input.userId,
            totalPoints: 0,
            currentLevelCode: "base_camp",
          },
          update: {},
        });

        if (existingEvent !== null) {
          return {
            replay: true,
            profile: mapProfile(profile),
            event: null,
            newBadges: [],
          } satisfies AwardEngagementPointsResult;
        }

        const event = await tx.engagementPointEvent.create({
          data: {
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            userId: input.userId,
            profileId: profile.id,
            pointsDelta: input.pointsDelta,
            sourceModule: input.sourceModule,
            sourceEventType: input.sourceEventType,
            sourceEntityId: input.sourceEntityId ?? null,
            dedupeKey: input.dedupeKey,
            reversesEventId: input.reversesEventId ?? null,
            actorUserId: input.actorUserId ?? null,
            actorRole: input.actorRole ?? null,
            reason: input.reason ?? null,
          },
        });

        const totalPoints = profile.totalPoints + input.pointsDelta;
        const level = resolveLevelForPoints(totalPoints);
        const updatedProfile = await tx.engagementProfile.update({
          where: { tenantId_id: { tenantId: input.tenantId, id: profile.id } },
          data: {
            totalPoints,
            currentLevelCode: level.code,
          },
        });

        const mappedProfile = mapProfile(updatedProfile);
        const newBadges = await ensureBadgesForProfile(
          tx,
          mappedProfile,
          input.sourceEventType,
        );

        return {
          replay: false,
          profile: mappedProfile,
          event: mapEvent(event),
          newBadges,
        } satisfies AwardEngagementPointsResult;
      });
    },

    async listPointEventsForUser({ tenantId, userId, workspaceId, limit, cursor }) {
      const rows = await prisma.engagementPointEvent.findMany({
        where: {
          tenantId,
          userId,
          ...(workspaceId !== undefined ? { workspaceId } : {}),
          ...(cursor !== undefined
            ? { createdAt: { lt: new Date(cursor) } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
      });
      const hasMore = rows.length > limit;
      const items = rows.slice(0, limit).map(mapEvent);
      const nextCursor =
        hasMore && items.length > 0
          ? items[items.length - 1]!.createdAt.toISOString()
          : null;
      return { items, hasMore, nextCursor };
    },

    async listBadgesForUser(tenantId, userId, workspaceId) {
      const rows = await prisma.memberEngagementBadge.findMany({
        where: {
          tenantId,
          userId,
          ...(workspaceId !== undefined ? { workspaceId } : {}),
        },
        orderBy: { earnedAt: "desc" },
      });
      return rows.map(mapBadge);
    },

    async listRecentPointEventsForWorkspace(tenantId, workspaceId, limit) {
      const rows = await prisma.engagementPointEvent.findMany({
        where: { tenantId, workspaceId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.map(mapEvent);
    },

    async listRecentBadgesForWorkspace(tenantId, workspaceId, limit) {
      const rows = await prisma.memberEngagementBadge.findMany({
        where: { tenantId, workspaceId },
        orderBy: { earnedAt: "desc" },
        take: limit,
      });
      return rows.map(mapBadge);
    },

    async findPointEventById(tenantId, eventId) {
      const row = await prisma.engagementPointEvent.findUnique({
        where: { tenantId_id: { tenantId, id: eventId } },
      });
      return row === null ? null : mapEvent(row);
    },
  };
}

export function findBadgeDefinition(code: string): EngagementBadgeDefinition | undefined {
  return DEFAULT_ENGAGEMENT_BADGES.find((badge) => badge.code === code);
}
