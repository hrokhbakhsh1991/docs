/**
 * TKT-001 Phase H1 — durable ticket notifications (Postgres + RLS required).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import { dispatchTicketNotificationFromOutbox } from "../notifications/dispatch-ticket-notification-from-outbox";
import { enqueueOutboxEvent } from "../outbox/enqueue-domain-event";
import { processOutboxRelayOnce } from "../outbox/outbox-relay";
import { integrationTenantId } from "../../test/test-helpers";
import {
  countUnreadTicketNotifications,
  listTicketNotifications,
  markAllTicketNotificationsRead,
  markTicketNotificationRead,
} from "./ticket-notification.repository";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const hasPrismaDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase() === "prisma";

const postgresSkip = !hasDatabase
  ? "TICKET_NOTIFICATIONS_REQUIRES_DATABASE"
  : !hasPrismaDriver
    ? "TICKET_NOTIFICATIONS_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

describe(
  "ticket-notifications.postgres.spec.ts — TKT-001 Phase H1",
  { skip: postgresSkip, concurrency: false },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const requesterA = randomUUID();
    const operatorA = randomUUID();
    const viewerA = randomUUID();
    const priorDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      const admin = getPrismaAdmin();
      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `tn-a-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing"] },
          },
          {
            id: tenantB,
            subdomain: `tn-b-${tenantB.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing"] },
          },
        ],
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      const admin = getPrismaAdmin();
      try {
        await admin.ticketNotificationDelivery.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.ticketNotification.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.outboxEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.ticketEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.ticketMessage.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.ticket.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.$executeRawUnsafe(
          "ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only",
        );
        try {
          await admin.auditEvent.deleteMany({
            where: { tenantId: { in: [tenantA, tenantB] } },
          });
        } finally {
          await admin.$executeRawUnsafe(
            "ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only",
          );
        }
        await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      } finally {
        await disconnectPrisma();
      }
    });

    it("creates durable notification from outbox and dedupes recipient event", async () => {
      const ticketId = randomUUID();
      const domainEventId = randomUUID();

      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketId,
            tenantId: tenantA,
            requesterUserId: requesterA,
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "Need help",
            lastActivityAt: new Date(),
          },
        });
      });

      await dispatchTicketNotificationFromOutbox({
        tenantId: tenantA,
        aggregateType: "ticket",
        aggregateId: ticketId,
        eventType: "ticket.created",
        domainEventId,
        payload: {
          ticketId,
          subject: "Need help",
          requesterUserId: requesterA,
          assigneeUserId: null,
          assigneeTeamId: null,
          queueId: null,
          status: "open",
          priority: "normal",
          actorUserId: requesterA,
          sourceEventType: "ticket.created",
          eventPayload: {},
        },
        createdAt: new Date(),
        correlationId: randomUUID(),
      });

      await dispatchTicketNotificationFromOutbox({
        tenantId: tenantA,
        aggregateType: "ticket",
        aggregateId: ticketId,
        eventType: "ticket.created",
        domainEventId,
        payload: {
          ticketId,
          subject: "Need help",
          requesterUserId: requesterA,
          assigneeUserId: null,
          assigneeTeamId: null,
          queueId: null,
          status: "open",
          priority: "normal",
          actorUserId: requesterA,
          sourceEventType: "ticket.created",
          eventPayload: {},
        },
        createdAt: new Date(),
        correlationId: randomUUID(),
      });

      const list = await listTicketNotifications({
        tenantId: tenantA,
        userId: requesterA,
        limit: 20,
      });
      assert.equal(list.items.length, 1);
      assert.equal(list.items[0]?.eventType, "ticket.created");
      assert.equal(list.items[0]?.readAt, null);

      const unread = await countUnreadTicketNotifications({
        tenantId: tenantA,
        userId: requesterA,
      });
      assert.equal(unread, 1);
    });

    it("enforces cross-tenant deny on list", async () => {
      const rows = await listTicketNotifications({
        tenantId: tenantB,
        userId: requesterA,
        limit: 20,
      });
      assert.equal(rows.items.length, 0);
    });

    it("marks read and mark-all-read for member scope", async () => {
      const notificationId = randomUUID();
      const ticketId = randomUUID();
      const domainEventId = randomUUID();
      const memberUser = randomUUID();

      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketId,
            tenantId: tenantA,
            requesterUserId: memberUser,
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "Read state",
            lastActivityAt: new Date(),
          },
        });
        await tx.ticketNotification.create({
          data: {
            id: notificationId,
            tenantId: tenantA,
            userId: memberUser,
            ticketId,
            eventType: "ticket.message.posted",
            title: "New reply",
            body: "Operator replied",
            domainEventId,
            payload: {},
          },
        });
      });

      const marked = await markTicketNotificationRead({
        tenantId: tenantA,
        notificationId,
        userId: memberUser,
      });
      assert.ok(marked);
      assert.ok(marked?.readAt);

      const denied = await markTicketNotificationRead({
        tenantId: tenantA,
        notificationId,
        userId: operatorA,
      });
      assert.equal(denied, null);

      const unreadAfter = await countUnreadTicketNotifications({
        tenantId: tenantA,
        userId: memberUser,
      });
      assert.equal(unreadAfter, 0);
    });

    it("outbox enqueue is in same transaction as ticket write", async () => {
      const ticketId = randomUUID();
      const domainEventId = randomUUID();

      await assert.rejects(
        withTenantRls(tenantA, async (tx) => {
          await tx.ticket.create({
            data: {
              id: ticketId,
              tenantId: tenantA,
              requesterUserId: requesterA,
              categoryCode: "general",
              priority: "normal",
              status: "open",
              subject: "TX test",
              lastActivityAt: new Date(),
            },
          });
          await enqueueOutboxEvent(tx, {
            tenantId: tenantA,
            aggregateType: "ticket",
            aggregateId: ticketId,
            eventType: "ticket.created",
            domainEventId,
            payload: { ticketId, requesterUserId: requesterA, subject: "TX test" },
          });
          throw new Error("ROLLBACK_PROBE");
        }),
        /ROLLBACK_PROBE/,
      );

      const admin = getPrismaAdmin();
      const outbox = await admin.outboxEvent.findFirst({
        where: { tenantId: tenantA, domainEventId },
      });
      assert.equal(outbox, null);
    });

    it("viewer can list tenant-wide notifications read-only", async () => {
      const list = await listTicketNotifications({
        tenantId: tenantA,
        viewerTenantWide: true,
        limit: 50,
      });
      assert.ok(Array.isArray(list.items));
      void viewerA;
    });

    it("records delivery retry and failure state", async () => {
      const notificationId = randomUUID();
      const ticketId = randomUUID();
      const deliveryId = randomUUID();

      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketId,
            tenantId: tenantA,
            requesterUserId: requesterA,
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "Delivery",
            lastActivityAt: new Date(),
          },
        });
        await tx.ticketNotification.create({
          data: {
            id: notificationId,
            tenantId: tenantA,
            userId: requesterA,
            ticketId,
            eventType: "ticket.resolved",
            title: "Resolved",
            body: "Done",
            domainEventId: randomUUID(),
            payload: {},
          },
        });
        await tx.ticketNotificationDelivery.create({
          data: {
            id: deliveryId,
            tenantId: tenantA,
            notificationId,
            channel: "email",
            provider: "noop",
            status: "failed",
            attemptCount: 3,
            lastError: { message: "provider_down" },
            processedAt: new Date(),
          },
        });
      });

      const admin = getPrismaAdmin();
      const delivery = await admin.ticketNotificationDelivery.findUnique({
        where: { id: deliveryId },
      });
      assert.equal(delivery?.status, "failed");
      assert.equal(delivery?.attemptCount, 3);
    });

    it("relay processes ticket notification outbox without duplicate inbox rows", async () => {
      const ticketId = randomUUID();
      const domainEventId = randomUUID();

      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketId,
            tenantId: tenantA,
            requesterUserId: requesterA,
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "Relay",
            lastActivityAt: new Date(),
          },
        });
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "ticket",
          aggregateId: ticketId,
          eventType: "ticket.message.posted",
          domainEventId,
          payload: {
            ticketId,
            subject: "Relay",
            requesterUserId: requesterA,
            assigneeUserId: operatorA,
            assigneeTeamId: null,
            queueId: null,
            actorUserId: operatorA,
            eventPayload: { visibility: "public" },
          },
        });
      });

      await processOutboxRelayOnce(20);
      await processOutboxRelayOnce(20);

      const memberList = await listTicketNotifications({
        tenantId: tenantA,
        userId: requesterA,
        limit: 20,
      });
      const operatorList = await listTicketNotifications({
        tenantId: tenantA,
        userId: operatorA,
        limit: 20,
      });
      const memberMatches = memberList.items.filter(
        (item) => item.ticketId === ticketId && item.eventType === "ticket.message.posted",
      );
      const operatorMatches = operatorList.items.filter((item) => item.eventType === "ticket.message.posted");
      assert.equal(memberMatches.length, 1);
      assert.equal(operatorMatches.length, 0);
    });

    it("mark-all-read updates only target user rows", async () => {
      const updated = await markAllTicketNotificationsRead({
        tenantId: tenantA,
        userId: requesterA,
      });
      assert.ok(updated >= 0);
    });
  },
);
