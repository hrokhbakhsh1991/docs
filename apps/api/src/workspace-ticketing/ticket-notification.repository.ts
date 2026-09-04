import type { MemberNotificationRow } from "../notifications/member-notification.types";
import {
  claimPendingMemberNotificationDeliveries,
  countUnreadMemberNotifications,
  findMemberNotificationById,
  listMemberNotifications,
  markAllMemberNotificationsRead,
  markMemberNotificationDeliveryResult,
  markMemberNotificationRead,
} from "../notifications/member-notification.repository";

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

function toTicketRow(row: MemberNotificationRow): TicketNotificationRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    ticketId: row.entityId ?? "",
    eventType: row.eventType,
    title: row.title,
    body: row.body,
    payload: row.payload,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

export async function listTicketNotifications(
  query: TicketNotificationListQuery,
): Promise<TicketNotificationListResult> {
  const result = await listMemberNotifications({
    tenantId: query.tenantId,
    userId: query.userId,
    viewerTenantWide: query.viewerTenantWide,
    sourceModule: "ticketing",
    unreadOnly: query.unreadOnly,
    cursor: query.cursor,
    limit: query.limit,
  });
  return {
    items: result.items.map(toTicketRow),
    hasMore: result.hasMore,
    nextCursor: result.nextCursor,
  };
}

export async function countUnreadTicketNotifications(input: {
  readonly tenantId: string;
  readonly userId?: string;
  readonly viewerTenantWide?: boolean;
}): Promise<number> {
  return countUnreadMemberNotifications({
    tenantId: input.tenantId,
    userId: input.userId,
    viewerTenantWide: input.viewerTenantWide,
    sourceModule: "ticketing",
  });
}

export async function markTicketNotificationRead(input: {
  readonly tenantId: string;
  readonly notificationId: string;
  readonly userId: string;
  readonly viewerTenantWide?: boolean;
}): Promise<TicketNotificationRow | null> {
  const row = await markMemberNotificationRead(input);
  return row === null ? null : toTicketRow(row);
}

export async function markAllTicketNotificationsRead(input: {
  readonly tenantId: string;
  readonly userId: string;
}): Promise<number> {
  return markAllMemberNotificationsRead({
    tenantId: input.tenantId,
    userId: input.userId,
    sourceModule: "ticketing",
  });
}

export async function findTicketNotificationById(
  tenantId: string,
  notificationId: string,
): Promise<TicketNotificationRow | null> {
  const row = await findMemberNotificationById(tenantId, notificationId);
  if (row === null || row.sourceModule !== "ticketing") {
    return null;
  }
  return toTicketRow(row);
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
  const deliveries = await claimPendingMemberNotificationDeliveries(tenantId, batchSize);
  return deliveries
    .filter((delivery) => delivery.sourceModule === "ticketing")
    .map((delivery) => ({
      id: delivery.id,
      notificationId: delivery.notificationId,
      channel: delivery.channel,
      attemptCount: delivery.attemptCount,
      userId: delivery.userId,
      ticketId: delivery.entityId ?? "",
      eventType: delivery.eventType,
      title: delivery.title,
      body: delivery.body,
      domainEventId: delivery.dedupeKey,
    }));
}

export async function markTicketNotificationDeliveryResult(
  tenantId: string,
  deliveryId: string,
  result: { readonly ok: true } | { readonly ok: false; readonly retryable: boolean; readonly error: string },
): Promise<void> {
  await markMemberNotificationDeliveryResult(tenantId, deliveryId, result);
}
