import { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";
import { isPrismaUniqueConstraintError } from "../db/prisma-error-instance";
import {
  insertMemberNotificationInboxRow,
  listMemberNotificationInbox,
  resetMemberNotificationInboxForTests,
} from "./member-notification-inbox.repository";
import type {
  MemberNotificationInsertInput,
  MemberNotificationListQuery,
  MemberNotificationListResult,
  MemberNotificationRow,
  MemberNotificationSourceModule,
} from "./member-notification.types";

function usePostgresInbox(): boolean {
  return process.env.STORAGE_DRIVER?.trim().toLowerCase() === "prisma";
}

function toIso(value: Date): string {
  return value.toISOString();
}

function mapRow(row: {
  id: string;
  tenantId: string;
  userId: string;
  sourceModule: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  title: string;
  body: string;
  titleKey: string | null;
  bodyKey: string | null;
  templateKey: string | null;
  dedupeKey: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
}): MemberNotificationRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    sourceModule: row.sourceModule as MemberNotificationSourceModule,
    eventType: row.eventType,
    entityType: row.entityType as MemberNotificationRow["entityType"],
    entityId: row.entityId,
    title: row.title,
    body: row.body,
    titleKey: row.titleKey,
    bodyKey: row.bodyKey,
    templateKey: row.templateKey,
    dedupeKey: row.dedupeKey,
    payload:
      row.payload !== null && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Readonly<Record<string, unknown>>)
        : {},
    readAt: row.readAt ? toIso(row.readAt) : null,
    createdAt: toIso(row.createdAt),
  };
}

function mapMemoryRow(row: {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly templateId: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly correlationId: string;
  readonly readAt: string | null;
  readonly createdAt: string;
}): MemberNotificationRow {
  const eventType = String(row.payload.eventType ?? "unknown");
  const sourceModule = inferSourceModuleFromTemplate(row.templateId);
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    sourceModule,
    eventType,
    entityType: inferEntityType(sourceModule),
    entityId: resolveEntityId(row.payload, sourceModule),
    title: row.titleKey,
    body: row.bodyKey,
    titleKey: row.titleKey,
    bodyKey: row.bodyKey,
    templateKey: row.templateId,
    dedupeKey: row.correlationId,
    payload: row.payload,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

function inferSourceModuleFromTemplate(templateId: string): MemberNotificationSourceModule {
  if (templateId.startsWith("booking.") || templateId.startsWith("tour.")) return "booking";
  if (templateId.startsWith("finance.") || templateId.startsWith("payment.")) return "finance";
  if (templateId.startsWith("wallet.")) return "wallet";
  return "booking";
}

function inferEntityType(
  sourceModule: MemberNotificationSourceModule,
): MemberNotificationRow["entityType"] {
  if (sourceModule === "ticketing") return "ticket";
  if (sourceModule === "finance") return "payment";
  if (sourceModule === "wallet") return "wallet_event";
  return "registration";
}

function resolveEntityId(
  payload: Readonly<Record<string, unknown>>,
  sourceModule: MemberNotificationSourceModule,
): string | null {
  if (sourceModule === "ticketing") {
    const ticketId = payload.ticketId;
    return typeof ticketId === "string" ? ticketId : null;
  }
  const registrationId = payload.registrationId;
  if (typeof registrationId === "string") return registrationId;
  const paymentId = payload.paymentId;
  if (typeof paymentId === "string") return paymentId;
  return null;
}

function decodeCursor(cursor: string): { readonly createdAt: Date; readonly id: string } {
  const [createdAt, id] = cursor.split("|");
  if (!createdAt || !id) {
    throw new Error("INVALID_NOTIFICATION_CURSOR");
  }
  return { createdAt: new Date(createdAt), id };
}

function encodeCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

export async function insertMemberNotificationRow(
  input: MemberNotificationInsertInput,
): Promise<string | null> {
  if (!usePostgresInbox()) {
    const row = insertMemberNotificationInboxRow({
      tenantId: input.tenantId,
      userId: input.userId,
      templateId: input.templateKey ?? `${input.sourceModule}.${input.eventType}`,
      titleKey: input.titleKey ?? input.title,
      bodyKey: input.bodyKey ?? input.body,
      payload: {
        ...input.payload,
        eventType: input.eventType,
        sourceModule: input.sourceModule,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        ticketId: input.entityType === "ticket" ? input.entityId : undefined,
        registrationId: input.entityType === "registration" ? input.entityId : undefined,
        paymentId: input.entityType === "payment" ? input.entityId : undefined,
      },
      correlationId: input.dedupeKey,
    });
    return row?.id ?? null;
  }

  return withTenantRls(input.tenantId, async (tx) => {
    try {
      const row = await tx.memberNotification.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          sourceModule: input.sourceModule,
          eventType: input.eventType,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          title: input.title,
          body: input.body,
          titleKey: input.titleKey ?? null,
          bodyKey: input.bodyKey ?? null,
          templateKey: input.templateKey ?? null,
          dedupeKey: input.dedupeKey,
          payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      if (input.enqueueEmailSms === true) {
        for (const channel of ["email", "sms"] as const) {
          try {
            await tx.memberNotificationDelivery.create({
              data: {
                tenantId: input.tenantId,
                notificationId: row.id,
                channel,
                provider: "noop",
                status: "pending",
                nextAttemptAt: new Date(),
              },
            });
          } catch (error: unknown) {
            if (!isPrismaUniqueConstraintError(error)) {
              throw error;
            }
          }
        }
      }
      return row.id;
    } catch (error: unknown) {
      if (isPrismaUniqueConstraintError(error)) {
        return null;
      }
      throw error;
    }
  });
}

export async function listMemberNotifications(
  query: MemberNotificationListQuery,
): Promise<MemberNotificationListResult> {
  if (!usePostgresInbox()) {
    const rows = listMemberNotificationInbox(query.tenantId, query.userId ?? "")
      .filter((row) => query.sourceModule === undefined || inferSourceModuleFromTemplate(row.templateId) === query.sourceModule)
      .filter((row) => query.unreadOnly !== true || row.readAt === null)
      .map(mapMemoryRow);
    return {
      items: rows.slice(0, query.limit),
      hasMore: rows.length > query.limit,
      nextCursor: null,
    };
  }

  return withTenantRls(query.tenantId, async (tx) => {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await tx.memberNotification.findMany({
      where: {
        tenantId: query.tenantId,
        ...(query.viewerTenantWide !== true && query.userId !== undefined
          ? { userId: query.userId }
          : {}),
        ...(query.sourceModule !== undefined ? { sourceModule: query.sourceModule } : {}),
        ...(query.unreadOnly === true ? { readAt: null } : {}),
        ...(cursor !== null
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page.at(-1);
    return {
      items: page.map(mapRow),
      hasMore,
      nextCursor: hasMore && last !== undefined ? encodeCursor(last.createdAt, last.id) : null,
    };
  });
}

export async function countUnreadMemberNotifications(input: {
  readonly tenantId: string;
  readonly userId?: string;
  readonly viewerTenantWide?: boolean;
  readonly sourceModule?: MemberNotificationSourceModule;
}): Promise<number> {
  if (!usePostgresInbox()) {
    return listMemberNotificationInbox(input.tenantId, input.userId ?? "").filter(
      (row) =>
        row.readAt === null &&
        (input.sourceModule === undefined ||
          inferSourceModuleFromTemplate(row.templateId) === input.sourceModule),
    ).length;
  }

  return withTenantRls(input.tenantId, async (tx) =>
    tx.memberNotification.count({
      where: {
        tenantId: input.tenantId,
        readAt: null,
        ...(input.viewerTenantWide !== true && input.userId !== undefined
          ? { userId: input.userId }
          : {}),
        ...(input.sourceModule !== undefined ? { sourceModule: input.sourceModule } : {}),
      },
    }),
  );
}

export async function markMemberNotificationRead(input: {
  readonly tenantId: string;
  readonly notificationId: string;
  readonly userId: string;
  readonly viewerTenantWide?: boolean;
}): Promise<MemberNotificationRow | null> {
  if (!usePostgresInbox()) {
    return null;
  }

  return withTenantRls(input.tenantId, async (tx) => {
    const existing = await tx.memberNotification.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.notificationId,
        ...(input.viewerTenantWide !== true ? { userId: input.userId } : {}),
      },
    });
    if (existing === null) {
      return null;
    }
    const row = await tx.memberNotification.update({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.notificationId } },
      data: { readAt: existing.readAt ?? new Date() },
    });
    return mapRow(row);
  });
}

export async function findMemberNotificationById(
  tenantId: string,
  notificationId: string,
): Promise<MemberNotificationRow | null> {
  if (!usePostgresInbox()) {
    return null;
  }

  return withTenantRls(tenantId, async (tx) => {
    const row = await tx.memberNotification.findFirst({
      where: { tenantId, id: notificationId },
    });
    return row === null ? null : mapRow(row);
  });
}

export async function markAllMemberNotificationsRead(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly sourceModule?: MemberNotificationSourceModule;
}): Promise<number> {
  if (!usePostgresInbox()) {
    return 0;
  }

  return withTenantRls(input.tenantId, async (tx) => {
    const result = await tx.memberNotification.updateMany({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        readAt: null,
        ...(input.sourceModule !== undefined ? { sourceModule: input.sourceModule } : {}),
      },
      data: { readAt: new Date() },
    });
    return result.count;
  });
}

export async function claimPendingMemberNotificationDeliveries(
  tenantId: string,
  batchSize: number,
): Promise<
  readonly {
    readonly id: string;
    readonly notificationId: string;
    readonly channel: string;
    readonly attemptCount: number;
    readonly userId: string;
    readonly sourceModule: string;
    readonly eventType: string;
    readonly entityType: string;
    readonly entityId: string | null;
    readonly title: string;
    readonly body: string;
    readonly dedupeKey: string;
  }[]
> {
  if (!usePostgresInbox()) {
    return [];
  }

  return withTenantRls(tenantId, async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        notification_id: string;
        channel: string;
        attempt_count: number;
        user_id: string;
        source_module: string;
        event_type: string;
        entity_type: string;
        entity_id: string | null;
        title: string;
        body: string;
        dedupe_key: string;
      }>
    >`
      SELECT d.id,
             d.notification_id,
             d.channel,
             d.attempt_count,
             n.user_id,
             n.source_module,
             n.event_type,
             n.entity_type,
             n.entity_id,
             n.title,
             n.body,
             n.dedupe_key
      FROM member_notification_deliveries d
      JOIN member_notifications n
        ON n.tenant_id = d.tenant_id AND n.id = d.notification_id
      WHERE d.tenant_id = ${tenantId}::uuid
        AND d.status = 'pending'
        AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= now())
      ORDER BY d.created_at ASC
      LIMIT ${batchSize}
      FOR UPDATE OF d SKIP LOCKED
    `;
    return rows.map((row) => ({
      id: row.id,
      notificationId: row.notification_id,
      channel: row.channel,
      attemptCount: row.attempt_count,
      userId: row.user_id,
      sourceModule: row.source_module,
      eventType: row.event_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
      body: row.body,
      dedupeKey: row.dedupe_key,
    }));
  });
}

export async function markMemberNotificationDeliveryResult(
  tenantId: string,
  deliveryId: string,
  result: { readonly ok: true } | { readonly ok: false; readonly retryable: boolean; readonly error: string },
): Promise<void> {
  if (!usePostgresInbox()) {
    return;
  }

  await withTenantRls(tenantId, async (tx) => {
    if (result.ok) {
      await tx.memberNotificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "delivered",
          processedAt: new Date(),
          attemptCount: { increment: 1 },
          lastError: Prisma.DbNull,
        },
      });
      return;
    }
    const nextAttempt = result.retryable
      ? new Date(Date.now() + Math.min(60_000 * (2 ** 1), 3_600_000))
      : null;
    await tx.memberNotificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: result.retryable ? "pending" : "failed",
        attemptCount: { increment: 1 },
        nextAttemptAt: nextAttempt,
        lastError: { message: result.error },
        processedAt: result.retryable ? null : new Date(),
      },
    });
  });
}

export { resetMemberNotificationInboxForTests };
