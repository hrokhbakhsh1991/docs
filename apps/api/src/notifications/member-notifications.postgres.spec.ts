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
import { dispatchTourScheduleNotificationFromOutbox } from "../notifications/dispatch-tour-schedule-notification-from-outbox";
import { dispatchTicketNotificationFromOutbox } from "../notifications/dispatch-ticket-notification-from-outbox";
import {
  countUnreadMemberNotifications,
  listMemberNotifications,
  markAllMemberNotificationsRead,
  markMemberNotificationRead,
} from "../notifications/member-notification.repository";
import { PrismaWalletRepository } from "../workspace-wallet/infrastructure/prisma-wallet.repository";
import { installPostgresNotificationTestIsolation } from "../../test/postgres-notification-test-isolation";
import { integrationTenantId, preparePostgresOutboxIsolation, quiesceStaleOutboxProcessing } from "../../test/test-helpers";
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
    const tenantB = integrationTenantId();
    const workspaceId = "mni-ws";
    const memberUser = randomUUID();
    const operatorId = randomUUID();
    const walletRepo = new PrismaWalletRepository();
    const priorDriver = process.env.STORAGE_DRIVER;

    installPostgresNotificationTestIsolation();

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      await preparePostgresOutboxIsolation();
      await assertPostgresAppRoleForRlsTests(getPrisma());
      const admin = getPrismaAdmin();
      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `mni-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing", "wallet", "engagement"] },
          },
          {
            id: tenantB,
            subdomain: `mni-b-${tenantB.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing", "wallet"] },
          },
        ],
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      const admin = getPrismaAdmin();
      try {
        await admin.memberNotificationDelivery.deleteMany({ where: { tenantId: tenantA } });
        await admin.memberNotification.deleteMany({ where: { tenantId: tenantA } });
        await admin.outboxEvent.deleteMany({ where: { tenantId: tenantA } });
        await admin.operatorRegistration.deleteMany({ where: { tenantId: tenantA } });
        await admin.$executeRawUnsafe(
          "TRUNCATE wallet_ledger_entries, wallet_transactions, wallet_accounts"
        );
        await admin.ticket.deleteMany({ where: { tenantId: tenantA } });
        await admin.$executeRawUnsafe(
          "ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only",
        );
        try {
          await admin.auditEvent.deleteMany({ where: { tenantId: tenantA } });
        } finally {
          await admin.$executeRawUnsafe(
            "ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only",
          );
        }
        await admin.$executeRawUnsafe(
          "ALTER TABLE engagement_point_events DISABLE TRIGGER engagement_point_events_append_only",
        );
        try {
          await admin.engagementPointEvent.deleteMany({ where: { tenantId: tenantA } });
          await admin.memberEngagementBadge.deleteMany({ where: { tenantId: tenantA } });
          await admin.engagementProfile.deleteMany({ where: { tenantId: tenantA } });
        } finally {
          await admin.$executeRawUnsafe(
            "ALTER TABLE engagement_point_events ENABLE TRIGGER engagement_point_events_append_only",
          );
        }
        await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
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

    it("relay: payment.confirmed via finance.ledger.double_entry_applied alias", async () => {
      const registrationId = randomUUID();
      const domainEventId = `payment:00000000-0000-4000-8000-000000000099:ledger-capture-anchor`;

      await withTenantRls(tenantA, async (tx) => {
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "FinanceLedger",
          aggregateId: randomUUID(),
          eventType: "finance.ledger.double_entry_applied",
          domainEventId,
          payload: {
            registrationId,
            guestUserId: memberUser,
            journalId: randomUUID(),
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
        (item) => item.eventType === "payment.confirmed" && item.dedupeKey === domainEventId,
      );
      assert.ok(match, "ledger capture must normalize to payment.confirmed inbox row");
    });

    it("relay: generic finance.ledger journal does not emit payment.confirmed", async () => {
      const domainEventId = `finance.ledger:${randomUUID()}:adjustment`;

      await withTenantRls(tenantA, async (tx) => {
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "FinanceLedger",
          aggregateId: randomUUID(),
          eventType: "finance.ledger.double_entry_applied",
          domainEventId,
          payload: {
            registrationId: randomUUID(),
            guestUserId: memberUser,
            journalId: randomUUID(),
          },
        });
      });

      await processOutboxRelayForTenantOnce(tenantA, 20);

      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
        sourceModule: "finance",
        limit: 20,
      });
      const match = list.items.find((item) => item.dedupeKey === domainEventId);
      assert.equal(match, undefined, "non-capture ledger must not create payment.confirmed row");
    });

    it("relay: tour.schedule.changed via tour.mutation.notification_required alias", async () => {
      const tourId = randomUUID();
      const registrationId = randomUUID();
      const domainEventId = `tour.schedule.changed:${tourId}:${Date.now()}`;

      await withTenantRls(tenantA, async (tx) => {
        await tx.operatorRegistration.create({
          data: {
            id: registrationId,
            tenantId: tenantA,
            tourId,
            tourTitle: "Alpine Trek",
            guestLabel: "Member Guest",
            partySize: 1,
            status: "approved",
            departureAt: new Date("2026-10-01T08:00:00.000Z"),
            submittedByUserId: memberUser,
            approvedAt: new Date(),
          },
        });
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "tour",
          aggregateId: tourId,
          eventType: "tour.mutation.notification_required",
          domainEventId,
          payload: {
            tourId,
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
        (item) =>
          item.eventType === "tour.schedule.changed" &&
          item.dedupeKey === `${domainEventId}:${memberUser}`,
      );
      assert.ok(match, "tour mutation alias must fan out via tour schedule dispatcher");
    });

    it("relay: attendance.marked via attendance.verified alias", async () => {
      const registrationId = randomUUID();
      const domainEventId = `attendance.marked:${registrationId}:${Date.now()}`;

      await withTenantRls(tenantA, async (tx) => {
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "registration",
          aggregateId: registrationId,
          eventType: "attendance.verified",
          domainEventId,
          payload: {
            guestUserId: memberUser,
            registrationId,
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
        (item) => item.eventType === "attendance.marked" && item.dedupeKey === domainEventId,
      );
      assert.ok(match, "attendance.verified must normalize to attendance.marked");
    });

    it("sms delivery marks failed when SMS_ENABLED=false", async () => {
      delete process.env.SMS_ENABLED;
      await dispatchMemberNotificationFromOutbox({
        tenantId: tenantA,
        aggregateType: "registration",
        aggregateId: randomUUID(),
        eventType: "registration.approved",
        domainEventId: `sms-test:${randomUUID()}`,
        payload: { guestUserId: memberUser, bookingId: randomUUID() },
        createdAt: new Date(),
        correlationId: randomUUID(),
      });

      const admin = getPrismaAdmin();
      const row = await admin.memberNotification.findFirst({
        where: { tenantId: tenantA, userId: memberUser, eventType: "registration.approved" },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(row);

      await admin.memberNotificationDelivery.create({
        data: {
          tenantId: tenantA,
          notificationId: row!.id,
          channel: "sms",
          provider: "noop",
          status: "pending",
          nextAttemptAt: new Date(),
        },
      });

      const { processTicketNotificationDeliveriesForTenantOnce } =
        await import("../notifications/process-ticket-notification-deliveries");
      const result = await processTicketNotificationDeliveriesForTenantOnce(tenantA, 5);
      assert.ok(result.processed + result.failed >= 1);

      const delivery = await admin.memberNotificationDelivery.findFirst({
        where: { tenantId: tenantA, notificationId: row!.id, channel: "sms" },
      });
      assert.equal(delivery?.status, "failed");
    });

    it("enforces FORCE RLS on member_notifications", async () => {
      const admin = getPrismaAdmin();
      const [{ relforcerowsecurity }] = await admin.$queryRaw<
        { relforcerowsecurity: boolean }[]
      >`
        SELECT relforcerowsecurity
        FROM pg_class
        WHERE relname = 'member_notifications'
      `;
      assert.equal(relforcerowsecurity, true, "member_notifications must FORCE ROW LEVEL SECURITY");
    });

    it("enforces cross-tenant deny on member notification list", async () => {
      await dispatchMemberNotificationFromOutbox({
        tenantId: tenantA,
        aggregateType: "registration",
        aggregateId: randomUUID(),
        eventType: "registration.approved",
        domainEventId: `rls:${randomUUID()}`,
        payload: { guestUserId: memberUser, bookingId: randomUUID() },
        createdAt: new Date(),
        correlationId: randomUUID(),
      });

      const crossTenant = await listMemberNotifications({
        tenantId: tenantB,
        userId: memberUser,
        limit: 20,
      });
      assert.equal(crossTenant.items.length, 0);
    });

    it("marks read and persists readAt after reload", async () => {
      const domainEventId = `read:${randomUUID()}`;
      await dispatchMemberNotificationFromOutbox({
        tenantId: tenantA,
        aggregateType: "registration",
        aggregateId: randomUUID(),
        eventType: "registration.approved",
        domainEventId,
        payload: { guestUserId: memberUser, bookingId: randomUUID() },
        createdAt: new Date(),
        correlationId: randomUUID(),
      });

      const before = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
        limit: 20,
      });
      const row = before.items.find((item) => item.dedupeKey === domainEventId);
      assert.ok(row);
      assert.equal(row!.readAt, null);

      const marked = await markMemberNotificationRead({
        tenantId: tenantA,
        notificationId: row!.id,
        userId: memberUser,
      });
      assert.ok(marked?.readAt);

      const after = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
        limit: 20,
      });
      const persisted = after.items.find((item) => item.id === row!.id);
      assert.ok(persisted?.readAt);
    });

    it("relay ticket.created creates exactly one member notification per domainEventId", async () => {
      const ticketId = randomUUID();
      const domainEventId = randomUUID();
      const admin = getPrismaAdmin();

      await admin.outboxEvent.deleteMany({
        where: { tenantId: tenantA, status: { in: ["pending", "processing"] } },
      });
      await quiesceStaleOutboxProcessing(0);

      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketId,
            tenantId: tenantA,
            requesterUserId: memberUser,
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "Dedupe ticket",
            ticketNumber: nextPostgresTestTicketNumber(),
            lastActivityAt: new Date(),
          },
        });
      });

      await withTenantRls(tenantA, async (tx) => {
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "ticket",
          aggregateId: ticketId,
          eventType: "ticket.created",
          domainEventId,
          payload: {
            ticketId,
            subject: "Dedupe ticket",
            requesterUserId: memberUser,
            assigneeUserId: null,
            assigneeTeamId: null,
            queueId: null,
            actorUserId: memberUser,
            eventPayload: {},
          },
        });
      });

      const relay1 = await processOutboxRelayForTenantOnce(tenantA, 20);
      assert.ok(relay1.published >= 1);

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const outboxRow = await admin.outboxEvent.findFirst({
          where: { tenantId: tenantA, domainEventId },
        });
        if (outboxRow?.status === "done") {
          break;
        }
        await processOutboxRelayForTenantOnce(tenantA, 20);
      }

      const outboxRow = await admin.outboxEvent.findFirst({
        where: { tenantId: tenantA, domainEventId },
      });
      assert.equal(outboxRow?.status, "done", "ticket.created outbox must be marked done after relay");

      const relay2 = await processOutboxRelayForTenantOnce(tenantA, 20);
      assert.equal(relay2.published, 0, "duplicate outbox row must not republish");
      const pendingCount = await admin.outboxEvent.count({
        where: { tenantId: tenantA, status: "pending" },
      });
      assert.equal(pendingCount, 0, "no pending outbox rows after ticket.created relay");

      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
        sourceModule: "ticketing",
        limit: 20,
      });
      const matches = list.items.filter((item) => item.dedupeKey === domainEventId);
      assert.equal(matches.length, 1, "ticket.created relay must not duplicate inbox rows");
    });

    it("alias normalization does not duplicate inbox rows for same domainEventId", async () => {
      const tourId = randomUUID();
      const registrationId = randomUUID();
      const domainEventId = `alias-dedupe:${randomUUID()}`;
      const row = {
        tenantId: tenantA,
        aggregateType: "tour",
        aggregateId: tourId,
        eventType: "tour.mutation.notification_required",
        domainEventId,
        payload: { tourId },
        createdAt: new Date(),
        correlationId: randomUUID(),
      };

      await withTenantRls(tenantA, async (tx) => {
        await tx.operatorRegistration.create({
          data: {
            id: registrationId,
            tenantId: tenantA,
            tourId,
            tourTitle: "Dedupe Trek",
            guestLabel: "Member Guest",
            partySize: 1,
            status: "approved",
            departureAt: new Date("2026-10-02T08:00:00.000Z"),
            submittedByUserId: memberUser,
            approvedAt: new Date(),
          },
        });
      });

      await dispatchTourScheduleNotificationFromOutbox(row);
      await dispatchTourScheduleNotificationFromOutbox(row);

      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
        sourceModule: "booking",
        limit: 50,
      });
      const matches = list.items.filter(
        (item) =>
          item.dedupeKey === `${domainEventId}:${memberUser}` &&
          item.eventType === "tour.schedule.changed",
      );
      assert.equal(matches.length, 1);
    });

    it("registration.approved relay creates engagement badge without duplicating booking row", async () => {
      const bookingId = randomUUID();
      const domainEventId = `engagement:${bookingId}:${Date.now()}`;

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

      await processOutboxRelayForTenantOnce(tenantA, 20);

      const bookingRows = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
        sourceModule: "booking",
        limit: 20,
      });
      const bookingMatches = bookingRows.items.filter((item) => item.dedupeKey === domainEventId);
      assert.equal(bookingMatches.length, 1);

      const engagementRows = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
        sourceModule: "engagement",
        limit: 20,
      });
      assert.ok(
        engagementRows.items.some((item) => item.eventType === "engagement.badge.earned"),
        "engagement badge is separate dedupe key, not duplicate booking row",
      );
    });
  }
);
