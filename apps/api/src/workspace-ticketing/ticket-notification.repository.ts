import { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";

export type TicketNotificationRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly ticketId: string;
  readonly eventType: string;
  readonly title: string;
  readonly body: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly readAt: string | null;
  readonly createdAt: string;
};

export type TicketNotificationListQuery = {
  readonly tenantId: string;
  readonly userId?: string;
  readonly viewerTenantWide?: boolean;
  readonly unreadOnly?: boolean;
  readonly cursor?: string | null;
  readonly limit: number;
};

export type TicketNotificationListResult = {
  readonly items: readonly TicketNotificationRow[];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
};

function toIso(value: Date): string {
  return value.toISOString();
}

function mapRow(row: {
  id: string;
  tenantId: string;
  userId: string;
  ticketId: string;
  eventType: string;
  title: string;
  body: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
}): TicketNotificationRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    ticketId: row.ticketId,
    eventType: row.eventType,
    title: row.title,
    body: row.body,
    payload:
      row.payload !== null && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Readonly<Record<string, unknown>>)
        : {},
    readAt: row.readAt ? toIso(row.readAt) : null,
    createdAt: toIso(row.createdAt),
  };
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

export async function listTicketNotifications(
  query: TicketNotificationListQuery,
): Promise<TicketNotificationListResult> {
  return withTenantRls(query.tenantId, async (tx) => {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await tx.ticketNotification.findMany({
      where: {
        tenantId: query.tenantId,
        ...(query.viewerTenantWide !== true && query.userId !== undefined
          ? { userId: query.userId }
          : {}),
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
      nextCursor:
        hasMore && last !== undefined ? encodeCursor(last.createdAt, last.id) : null,
    };
  });
}

export async function countUnreadTicketNotifications(input: {
  readonly tenantId: string;
  readonly userId?: string;
  readonly viewerTenantWide?: boolean;
}): Promise<number> {
  return withTenantRls(input.tenantId, async (tx) =>
    tx.ticketNotification.count({
      where: {
        tenantId: input.tenantId,
        readAt: null,
        ...(input.viewerTenantWide !== true && input.userId !== undefined
          ? { userId: input.userId }
          : {}),
      },
    }),
  );
}

export async function markTicketNotificationRead(input: {
  readonly tenantId: string;
  readonly notificationId: string;
  readonly userId: string;
  readonly viewerTenantWide?: boolean;
}): Promise<TicketNotificationRow | null> {
  return withTenantRls(input.tenantId, async (tx) => {
    const existing = await tx.ticketNotification.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.notificationId,
        ...(input.viewerTenantWide !== true ? { userId: input.userId } : {}),
      },
    });
    if (existing === null) {
      return null;
    }
    const row = await tx.ticketNotification.update({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.notificationId } },
      data: { readAt: existing.readAt ?? new Date() },
    });
    return mapRow(row);
  });
}

export async function markAllTicketNotificationsRead(input: {
  readonly tenantId: string;
  readonly userId: string;
}): Promise<number> {
  return withTenantRls(input.tenantId, async (tx) => {
    const result = await tx.ticketNotification.updateMany({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return result.count;
  });
}

export async function findTicketNotificationById(
  tenantId: string,
  notificationId: string,
): Promise<TicketNotificationRow | null> {
  return withTenantRls(tenantId, async (tx) => {
    const row = await tx.ticketNotification.findFirst({
      where: { tenantId, id: notificationId },
    });
    return row === null ? null : mapRow(row);
  });
}

export async function claimPendingTicketNotificationDeliveries(
  tenantId: string,
  batchSize: number,
): Promise<
  readonly {
    readonly id: string;
    readonly notificationId: string;
    readonly channel: string;
    readonly attemptCount: number;
    readonly userId: string;
    readonly ticketId: string;
    readonly eventType: string;
    readonly title: string;
    readonly body: string;
    readonly domainEventId: string;
  }[]
> {
  return withTenantRls(tenantId, async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        notification_id: string;
        channel: string;
        attempt_count: number;
        user_id: string;
        ticket_id: string;
        event_type: string;
        title: string;
        body: string;
        domain_event_id: string;
      }>
    >`
      SELECT d.id,
             d.notification_id,
             d.channel,
             d.attempt_count,
             n.user_id,
             n.ticket_id,
             n.event_type,
             n.title,
             n.body,
             n.domain_event_id
      FROM ticket_notification_deliveries d
      JOIN ticket_notifications n
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
      ticketId: row.ticket_id,
      eventType: row.event_type,
      title: row.title,
      body: row.body,
      domainEventId: row.domain_event_id,
    }));
  });
}

export async function markTicketNotificationDeliveryResult(
  tenantId: string,
  deliveryId: string,
  result: { readonly ok: true } | { readonly ok: false; readonly retryable: boolean; readonly error: string },
): Promise<void> {
  await withTenantRls(tenantId, async (tx) => {
    if (result.ok) {
      await tx.ticketNotificationDelivery.update({
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
    await tx.ticketNotificationDelivery.update({
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
