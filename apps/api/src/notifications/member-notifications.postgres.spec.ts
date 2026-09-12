/**
 * MNI-001 — shared member notification inbox (Postgres + RLS + cross-domain).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrisma, getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import { enqueueOutboxEvent } from "../outbox/enqueue-domain-event";
import { processOutboxRelayForTenantOnce } from "../outbox/outbox-relay";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { dispatchMemberNotificationFromOutbox } from "../notifications/dispatch-member-notification-from-outbox";
import { dispatchTicketNotificationFromOutbox } from "../notifications/dispatch-ticket-notification-from-outbox";
import {
  countUnreadMemberNotifications,
  listMemberNotifications,
} from "../notifications/member-notification.repository";
import { PrismaWalletRepository } from "../workspace-wallet/infrastructure/prisma-wallet.repository";
import { integrationTenantId } from "../../test/test-helpers";
import {
  assertPostgresAppRoleForRlsTests,
  nextPostgresTestTicketNumber,
} from "../workspace-ticketing/ticketing-postgres-test-helpers";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const hasPrismaDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase() === "prisma";

const postgresSkip = !hasDatabase
  ? "MEMBER_NOTIFICATIONS_REQUIRES_DATABASE"
  : !hasPrismaDriver
    ? "MEMBER_NOTIFICATIONS_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

function memberScope(tenantId: string, workspaceId: string, userId: string) {
  return { tenantId, workspaceId, userId };
}

function walletActor(operatorId: string) {
  return { actorUserId: operatorId, actorRole: "operator" as const };
}

describe(
  "member-notifications.postgres.spec.ts — MNI-001",
  { skip: postgresSkip, concurrency: false },
  () => {
    const tenantA = integrationTenantId();
    const workspaceId = "mni-ws";
    const memberUser = randomUUID();
    const operatorId = randomUUID();
    const walletRepo = new PrismaWalletRepository();
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
        await admin.outboxEvent.deleteMany({ where: { tenantId: tenantA } });
        await admin.$executeRawUnsafe(
          "TRUNCATE wallet_ledger_entries, wallet_transactions, wallet_accounts"
        );
        await admin.ticket.deleteMany({ where: { tenantId: tenantA } });
        await admin.$executeRawUnsafe(
          "ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only"
        );
        await admin.$executeRawUnsafe(
          "ALTER TABLE engagement_point_events DISABLE TRIGGER engagement_point_events_append_only"
        );
        try {
          await admin.auditEvent.deleteMany({ where: { tenantId: tenantA } });
          await admin.$executeRawUnsafe(
            `DELETE FROM engagement_point_events WHERE tenant_id = '${tenantA}'::uuid`
          );
          await admin.memberEngagementBadge.deleteMany({ where: { tenantId: tenantA } });
          await admin.engagementProfile.deleteMany({ where: { tenantId: tenantA } });
        } finally {
          await admin.$executeRawUnsafe(
            "ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only"
          );
          await admin.$executeRawUnsafe(
            "ALTER TABLE engagement_point_events ENABLE TRIGGER engagement_point_events_append_only"
          );
        }
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

      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
        limit: 20,
      });
      assert.equal(list.items.length, 3);
      const modules = new Set(list.items.map((item) => item.sourceModule));
      assert.ok(modules.has("ticketing"));
      assert.ok(modules.has("booking"));
      assert.ok(modules.has("finance"));
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

    it("relay: booking registration.approved outbox → member_notifications", async () => {
      const bookingId = randomUUID();
      const domainEventId = `registration.approved:${bookingId}:${new Date().toISOString()}`;

      await withTenantRls(tenantA, async (tx) => {
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "registration",
          aggregateId: bookingId,
          eventType: "registration.approved",
          domainEventId,
          payload: {
            guestUserId: memberUser,
            bookingId,
            registrationId: bookingId,
          },
        });
      });

      const relay = await processOutboxRelayForTenantOnce(tenantA, 20);
      assert.ok(relay.published >= 1, JSON.stringify(relay));

      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
        sourceModule: "booking",
        limit: 20,
      });
      const match = list.items.find(
        (item) => item.eventType === "registration.approved" && item.dedupeKey === domainEventId
      );
      assert.ok(match, "booking relay must create member notification");
    });

    it("relay: finance payment.hold.scheduled outbox → member_notifications", async () => {
      const paymentId = randomUUID();
      const bookingId = randomUUID();
      const domainEventId = `payment.hold.scheduled:${bookingId}:${new Date().toISOString()}`;

      await withTenantRls(tenantA, async (tx) => {
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "payment",
          aggregateId: paymentId,
          eventType: "payment.hold.scheduled",
          domainEventId,
          payload: {
            guestUserId: memberUser,
            paymentId,
            bookingId,
          },
        });
      });

      const relay = await processOutboxRelayForTenantOnce(tenantA, 20);
      assert.ok(relay.published >= 1, JSON.stringify(relay));

      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
        sourceModule: "finance",
        limit: 20,
      });
      const match = list.items.find(
        (item) => item.eventType === "payment.hold.scheduled" && item.dedupeKey === domainEventId
      );
      assert.ok(match, "finance relay must create member notification");
    });

    it("relay: wallet operatorCredit outbox → member_notifications", async () => {
      const account = await runWithTenantContext(
        tenantA,
        () =>
          walletRepo.getOrCreateAccount({
            ...memberScope(tenantA, workspaceId, memberUser),
            currency: "USD",
          }),
        { actorId: operatorId }
      );
      assert.equal(account.ok, true);
      if (!account.ok) return;

      const credit = await runWithTenantContext(
        tenantA,
        () =>
          walletRepo.operatorCredit({
            ...memberScope(tenantA, workspaceId, memberUser),
            accountId: account.value.id,
            amountMinor: "1500",
            currency: "USD",
            creationIdempotencyKey: `mni-wallet-relay-${randomUUID()}`,
            reference: null,
            actor: walletActor(operatorId),
          }),
        { actorId: operatorId }
      );
      assert.equal(credit.ok, true);
      if (!credit.ok) return;

      const admin = getPrismaAdmin();
      const pending = await admin.outboxEvent.findMany({
        where: {
          tenantId: tenantA,
          aggregateId: credit.value.transaction.id,
          eventType: "wallet.transaction.posted",
          status: "pending",
        },
      });
      assert.equal(pending.length, 1, "operatorCredit must enqueue wallet outbox row");

      const relay = await processOutboxRelayForTenantOnce(tenantA, 20);
      assert.ok(relay.published >= 1, JSON.stringify(relay));

      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
        sourceModule: "wallet",
        limit: 20,
      });
      const match = list.items.find(
        (item) =>
          item.eventType === "wallet.transaction.posted" &&
          item.dedupeKey === pending[0]!.domainEventId
      );
      assert.ok(match, "wallet relay must create member notification from real outbox writer");

      const unread = await countUnreadMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
      });
      assert.ok(unread >= 1);
    });
  }
);
