import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import { BOOKING_APPROVE_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";

import { insertMemberNotificationRow } from "../notifications/member-notification.repository";
import { withTenantRls } from "../db/with-tenant-rls";
import type { WorkspaceOutboxPublishedRow } from "../workspace/workspace-outbox-row-context";
import { buildAwardDedupeKey } from "./engagement-admin-catalog";
import { assertEngagementWorkspaceGate } from "./engagement-module-enabled";
import {
  createPrismaEngagementDefinitionsRepository,
  findBadgeDefinitionFromRows,
} from "./infrastructure/prisma-engagement-definitions.repository";
import { createPrismaEngagementRepository } from "./infrastructure/prisma-engagement.repository";

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asRecord(payload: unknown): Readonly<Record<string, unknown>> {
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Readonly<Record<string, unknown>>;
  }
  return {};
}

export async function notifyEngagementBadgeEarned(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly badgeCode: string;
  readonly dedupeKey: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly title: string;
  readonly body: string;
}): Promise<void> {
  await insertMemberNotificationRow({
    tenantId: input.tenantId,
    userId: input.userId,
    sourceModule: "engagement",
    eventType: "engagement.badge.earned",
    entityType: "engagement_event",
    entityId: null,
    titleKey: input.titleKey,
    bodyKey: input.bodyKey,
    templateKey: `engagement.badge.${input.badgeCode}`,
    title: input.title,
    body: input.body,
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

  const definitionsRepository = createPrismaEngagementDefinitionsRepository();
  await definitionsRepository.ensureSeeded(input.tenantId, input.workspaceId);
  const rule =
    input.pointsOverride === undefined
      ? await definitionsRepository.resolveActiveAwardRule(
          input.tenantId,
          input.workspaceId,
          input.eventType,
        )
      : null;
  if (rule === null && input.pointsOverride === undefined) {
    return;
  }

  const repository = createPrismaEngagementRepository();
  const result = await repository.awardPoints({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    pointsDelta: input.pointsOverride ?? rule!.points,
    sourceModule: input.sourceModule ?? rule!.sourceModule,
    sourceEventType: input.eventType,
    sourceEntityId: input.sourceEntityId ?? null,
    dedupeKey:
      input.dedupeKey ??
      buildAwardDedupeKey(
        rule?.dedupePolicy ?? "per_user",
        input.eventType,
        input.userId,
        input.sourceEntityId,
      ),
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    reason: input.reason ?? null,
  });

  if (result.replay) {
    return;
  }

  const activeBadges = await definitionsRepository.listActiveBadgesForAward(
    input.tenantId,
    input.workspaceId,
  );

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
      titleKey: `engagement.badge.${badge.badgeCode}.label`,
      bodyKey: `engagement.badge.${badge.badgeCode}.description`,
      title: definition.titleI18n.en,
      body: definition.descriptionI18n.en,
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
  let gate;
  try {
    gate = await assertEngagementWorkspaceGate(auth.tenantId);
  } catch {
    return;
  }
  await processEngagementAward({
    tenantId: auth.tenantId,
    workspaceId: gate.workspaceType,
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
  let userId = optionalString(payload.guestUserId);
  if (userId === undefined) {
    const registrationId = optionalString(payload.bookingId) ?? row.aggregateId;
    if (
      registrationId !== undefined &&
      process.env.STORAGE_DRIVER?.trim().toLowerCase() === "prisma"
    ) {
      userId = await withTenantRls(row.tenantId, async (tx) => {
        const registration = await tx.operatorRegistration.findFirst({
          where: { tenantId: row.tenantId, id: registrationId },
          select: { submittedByUserId: true },
        });
        return optionalString(registration?.submittedByUserId);
      });
    }
  }
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
