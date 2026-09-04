/**
 * MNI-001 — shared member notification inbox (Postgres + RLS + cross-domain).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrisma, getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import { dispatchMemberNotificationFromOutbox } from "../notifications/dispatch-member-notification-from-outbox";
import { dispatchTicketNotificationFromOutbox } from "../notifications/dispatch-ticket-notification-from-outbox";
import { dispatchWalletNotificationFromOutbox } from "../notifications/dispatch-wallet-notification-from-outbox";
import {
  countUnreadMemberNotifications,
  listMemberNotifications,
} from "../notifications/member-notification.repository";
import { integrationTenantId } from "../../test/test-helpers";
import { assertPostgresAppRoleForRlsTests, nextPostgresTestTicketNumber } from "../workspace-ticketing/ticketing-postgres-test-helpers";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const hasPrismaDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase() === "prisma";

const postgresSkip = !hasDatabase
  ? "MEMBER_NOTIFICATIONS_REQUIRES_DATABASE"
  : !hasPrismaDriver
    ? "MEMBER_NOTIFICATIONS_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

describe(
  "member-notifications.postgres.spec.ts — MNI-001",
  { skip: postgresSkip, concurrency: false },
  () => {
    const tenantA = integrationTenantId();
    const memberUser = randomUUID();
    const priorDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      await assertPostgresAppRoleForRlsTests(getPrisma());
      const admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantA,
          subdomain: `mni-${tenantA.slice(0, 8)}`,
          workspaceType: "denali",
          theme: { enabledModules: ["ticketing", "wallet"] },
        },
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      const admin = getPrismaAdmin();
      try {
        await admin.memberNotificationDelivery.deleteMany({ where: { tenantId: tenantA } });
        await admin.memberNotification.deleteMany({ where: { tenantId: tenantA } });
        await admin.ticket.deleteMany({ where: { tenantId: tenantA } });
        await admin.tenant.deleteMany({ where: { id: tenantA } });
      } finally {
        await disconnectPrisma();
      }
    });

    it("aggregates ticketing, booking, finance, and wallet notifications", async () => {
      const ticketId = randomUUID();
      const domainEventId = randomUUID();

      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketId,
            tenantId: tenantA,
            requesterUserId: memberUser,
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "Cross-domain",
            ticketNumber: nextPostgresTestTicketNumber(),
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
          subject: "Cross-domain",
          requesterUserId: memberUser,
          assigneeUserId: null,
          assigneeTeamId: null,
          queueId: null,
          actorUserId: memberUser,
          eventPayload: {},
        },
        createdAt: new Date(),
        correlationId: randomUUID(),
      });

      await dispatchMemberNotificationFromOutbox({
        tenantId: tenantA,
        aggregateType: "registration",
        aggregateId: randomUUID(),
        eventType: "registration.approved",
        domainEventId: `registration.approved:${memberUser}`,
        payload: { guestUserId: memberUser, bookingId: randomUUID() },
        createdAt: new Date(),
        correlationId: randomUUID(),
      });

      await dispatchMemberNotificationFromOutbox({
        tenantId: tenantA,
        aggregateType: "payment",
        aggregateId: randomUUID(),
        eventType: "payment.hold.scheduled",
        domainEventId: `payment.hold.scheduled:${memberUser}`,
        payload: { guestUserId: memberUser, paymentId: randomUUID() },
        createdAt: new Date(),
        correlationId: randomUUID(),
      });

      await dispatchWalletNotificationFromOutbox({
        tenantId: tenantA,
        aggregateType: "wallet_transaction",
        aggregateId: randomUUID(),
        eventType: "wallet.transaction.posted",
        domainEventId: `wallet.transaction.posted:${memberUser}`,
        payload: { userId: memberUser, transactionId: randomUUID() },
        createdAt: new Date(),
        correlationId: randomUUID(),
      });

      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
        limit: 20,
      });
      assert.equal(list.items.length, 4);
      const modules = new Set(list.items.map((item) => item.sourceModule));
      assert.ok(modules.has("ticketing"));
      assert.ok(modules.has("booking"));
      assert.ok(modules.has("finance"));
      assert.ok(modules.has("wallet"));

      const unread = await countUnreadMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
      });
      assert.equal(unread, 4);
    });

    it("dedupes repeated domain events per recipient", async () => {
      const domainEventId = `dedupe:${randomUUID()}`;
      const row = {
        tenantId: tenantA,
        aggregateType: "registration",
        aggregateId: randomUUID(),
        eventType: "registration.waitlisted",
        domainEventId,
        payload: { guestUserId: memberUser, bookingId: randomUUID() },
        createdAt: new Date(),
        correlationId: randomUUID(),
      };

      await dispatchMemberNotificationFromOutbox(row);
      await dispatchMemberNotificationFromOutbox(row);

      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
        sourceModule: "booking",
        limit: 50,
      });
      const matches = list.items.filter((item) => item.dedupeKey === domainEventId);
      assert.equal(matches.length, 1);
    });
  },
);
