import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import { BOOKING_APPROVE_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";

import { insertMemberNotificationRow } from "../notifications/member-notification.repository";
import type { WorkspaceOutboxPublishedRow } from "../workspace/workspace-outbox-row-context";
import { DEFAULT_ENGAGEMENT_AWARD_RULES } from "./engagement-policy";
import { assertEngagementWorkspaceGate } from "./engagement-module-enabled";
import { createPrismaEngagementRepository, findBadgeDefinition } from "./infrastructure/prisma-engagement.repository";

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asRecord(payload: unknown): Readonly<Record<string, unknown>> {
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Readonly<Record<string, unknown>>;
  }
  return {};
}

async function notifyBadgeEarned(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly badgeCode: string;
  readonly dedupeKey: string;
}): Promise<void> {
  const badge = findBadgeDefinition(input.badgeCode);
  if (badge === undefined) {
    return;
  }
  await insertMemberNotificationRow({
    tenantId: input.tenantId,
    userId: input.userId,
    sourceModule: "engagement",
    eventType: "engagement.badge.earned",
    entityType: "engagement_event",
    entityId: null,
    titleKey: badge.labelKey,
    bodyKey: badge.descriptionKey,
    templateKey: `engagement.badge.${input.badgeCode}`,
    title: badge.code,
    body: badge.code,
    dedupeKey: input.dedupeKey,
    payload: { badgeCode: input.badgeCode },
  });
}

export async function processEngagementAward(input: {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly eventType: string;
  readonly sourceModule: string;
  readonly sourceEntityId?: string | null;
  readonly dedupeKey: string;
  readonly actorUserId?: string | null;
  readonly actorRole?: string | null;
  readonly reason?: string | null;
  readonly pointsOverride?: number;
}): Promise<void> {
  try {
    await assertEngagementWorkspaceGate(input.tenantId);
  } catch {
    return;
  }

  const rule = DEFAULT_ENGAGEMENT_AWARD_RULES.find((entry) => entry.eventType === input.eventType);
  if (rule === undefined && input.pointsOverride === undefined) {
    return;
  }

  const repository = createPrismaEngagementRepository();
  const result = await repository.awardPoints({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    pointsDelta: input.pointsOverride ?? rule!.points,
    sourceModule: input.sourceModule,
    sourceEventType: input.eventType,
    sourceEntityId: input.sourceEntityId ?? null,
    dedupeKey: input.dedupeKey,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    reason: input.reason ?? null,
  });

  if (result.replay) {
    return;
  }

  for (const badge of result.newBadges) {
    await notifyBadgeEarned({
      tenantId: badge.tenantId,
      userId: badge.userId,
      badgeCode: badge.badgeCode,
      dedupeKey: `engagement:notification:badge:${badge.badgeCode}:${badge.userId}`,
    });
  }
}

export async function processProfileEngagementAward(
  auth: TenantAuthContext,
  profileComplete: boolean,
): Promise<void> {
  if (!profileComplete) {
    return;
  }
  const workspaceId = auth.workspaceId?.trim();
  if (workspaceId === undefined || workspaceId.length === 0) {
    return;
  }
  await processEngagementAward({
    tenantId: auth.tenantId,
    workspaceId,
    userId: auth.userId,
    eventType: "profile.completed",
    sourceModule: "identity",
    dedupeKey: `engagement:profile.completed:${auth.userId}`,
  });
}

export async function dispatchEngagementFromOutbox(row: WorkspaceOutboxPublishedRow): Promise<void> {
  if (row.eventType !== BOOKING_APPROVE_OUTBOX_EVENT_TYPE) {
    return;
  }

  const payload = asRecord(row.payload);
  const userId = optionalString(payload.guestUserId);
  if (userId === undefined) {
    return;
  }

  let gate;
  try {
    gate = await assertEngagementWorkspaceGate(row.tenantId);
  } catch {
    return;
  }

  const workspaceId = gate.workspaceType;
  await processEngagementAward({
    tenantId: row.tenantId,
    workspaceId,
    userId,
    eventType: "registration.first_approved",
    sourceModule: "booking",
    sourceEntityId: optionalString(payload.bookingId) ?? row.aggregateId,
    dedupeKey: `engagement:registration.first_approved:${userId}`,
  });
}
