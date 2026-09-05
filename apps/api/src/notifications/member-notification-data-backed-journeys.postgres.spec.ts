/**
 * MNI-DATA-BACKED — real business operations → outbox → relay → member_notifications.
 * Forbidden: direct insertMemberNotificationRow, enqueueOutboxEvent in journey tests, memory driver.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { createRequestListener } from "../app";
import {
  getBookingsRepository,
  resetBookingsRepositorySingletonForTests,
} from "../bookings/create-bookings-repository";
import { resetBookingsServiceCompositionForTests } from "../bookings/create-bookings-service";
import { PrismaBookingsRepository } from "../bookings/prisma-bookings.repository";
import { resetLazyFinanceServiceForTests } from "../boot/lazy-finance-service";
import { resetLazyRouteHandlersForTests } from "../boot/lazy-route-handlers";
import { resetLazyTicketingServiceForTests } from "../boot/lazy-ticketing-service";
import { resetLazyWorkspaceFinanceHandlersForTests } from "../boot/lazy-workspace-finance-handlers";
import { disconnectPrisma, getPrisma } from "../db/prisma";
import { processOutboxRelayForTenantOnce } from "../outbox/outbox-relay";
import {
  countUnreadMemberNotifications,
  findMemberNotificationById,
  listMemberNotifications,
  markMemberNotificationDeliveryResult,
} from "../notifications/member-notification.repository";
import { processTicketNotificationDeliveriesForTenantOnce } from "../notifications/process-ticket-notification-deliveries";
import { PrismaWalletRepository } from "../workspace-wallet/infrastructure/prisma-wallet.repository";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { PrismaTourRepository } from "../storage/prisma-tour.repository";
import { createPrismaEngagementDefinitionsRepository } from "../workspace-engagement/infrastructure/prisma-engagement-definitions.repository";
import { assertPostgresAppRoleForRlsTests } from "../workspace-ticketing/ticketing-postgres-test-helpers";
import { integrationTenantId, createTestToursService, quiesceStaleOutboxProcessing } from "../../test/test-helpers";
import {
  buildOperatorSmokePublishedTourCanonical,
  OPERATOR_SMOKE_PUBLISHED_TOUR_CATALOG,
} from "../fixtures/operator-smoke-published-tour.fixture";
import { getSettingsResourcesRepository } from "../settings/create-settings-resources-repository";
import { seedOperatorSmokeCatalog } from "../settings/seed-operator-smoke-catalog";
import { ensureDefaultTicketTemplatesForTenant } from "../workspace-ticketing/ticket-template.repository";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const hasPrismaDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase() === "prisma";
const postgresSkip = !hasDatabase
  ? "MNI_DATA_BACKED_REQUIRES_DATABASE"
  : !hasPrismaDriver
    ? "MNI_DATA_BACKED_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

function authHeaders(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly role?: "admin" | "owner" | "member";
  readonly workspaceId?: string;
}): Record<string, string> {
  return {
    "x-tenant-id": input.tenantId,
    "x-authenticated-tenant-id": input.tenantId,
    "x-user-id": input.userId,
    "x-actor-role": input.role ?? "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": input.workspaceId ?? "ws-mni-data-backed",
  };
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly tenantId: string;
    readonly userId: string;
    readonly role?: "admin" | "owner" | "member";
    readonly body?: unknown;
    readonly idempotencyKey?: string;
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const payload = input.body === undefined ? undefined : JSON.stringify(input.body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: input.path,
          method: input.method,
          headers: {
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": String(Buffer.byteLength(payload)),
                }
              : {}),
            ...(input.idempotencyKey !== undefined
              ? { "idempotency-key": input.idempotencyKey }
              : {}),
            ...authHeaders(input),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            server.close();
            const text = Buffer.concat(chunks).toString("utf8");
            let body: Record<string, unknown> = {};
            if (text.length > 0) body = JSON.parse(text) as Record<string, unknown>;
            resolve({ status: res.statusCode ?? 0, body });
          });
        },
      );
      req.on("error", (error) => {
        server.close();
        reject(error);
      });
      if (payload !== undefined) req.write(payload);
      req.end();
    });
  });
}

describe(
  "member-notification-data-backed-journeys.postgres.spec.ts",
  { skip: postgresSkip, concurrency: false },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const tourId = randomUUID();
    const tourCanonical = buildOperatorSmokePublishedTourCanonical(
      OPERATOR_SMOKE_PUBLISHED_TOUR_CATALOG,
    );
    const memberUser = randomUUID();
    const memberB = randomUUID();
    const operatorId = randomUUID();
    const ownerAuth: TenantAuthContext = {
      tenantId: tenantA,
      userId: operatorId,
      role: "owner",
      status: "ACTIVE",
      workspaceId: "ws-mni-data-backed",
    };
    const walletRepo = new PrismaWalletRepository();
    const listener = createRequestListener({
      toursService: createTestToursService(new PrismaTourRepository()),
    });
    let admin: PrismaClient;
    const priorDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.OUTBOX_RELAY_ENABLED = "false";
      process.env.PROJECTION_AUTO_RECONCILE_ENABLED = "false";
      process.env.PAYMENT_HOLD_ENABLED = "true";
      delete process.env.SMS_ENABLED;

      resetLazyRouteHandlersForTests();
      resetLazyFinanceServiceForTests();
      resetLazyWorkspaceFinanceHandlersForTests();
      resetLazyTicketingServiceForTests();
      resetBookingsRepositorySingletonForTests();
      resetBookingsServiceCompositionForTests();

      await assertPostgresAppRoleForRlsTests(getPrisma());
      admin = new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL_ADMIN!.trim() } },
      });

      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `mni-db-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing", "wallet", "engagement", "finance"] },
          },
          {
            id: tenantB,
            subdomain: `mni-db-b-${tenantB.slice(0, 8)}`,
            workspaceType: "denali",
            theme: {},
          },
        ],
      });

      await seedOperatorSmokeCatalog(getSettingsResourcesRepository(), { tenantId: tenantA });

      await admin.tour.create({
        data: {
          id: tourId,
          tenantId: tenantA,
          title: "MNI Data-Backed Tour",
          publishStatus: "published",
          canonical: tourCanonical as object,
        },
      });

      await ensureDefaultTicketTemplatesForTenant(tenantA);

      await createPrismaEngagementDefinitionsRepository().ensureSeeded(tenantA, "denali");
      assert.ok(getBookingsRepository() instanceof PrismaBookingsRepository);
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      try {
        await admin.memberNotificationDelivery.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.memberNotification.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.outboxEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.httpIdempotencyRecord.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.operatorRegistration.deleteMany({ where: { tenantId: tenantA } });
        await admin.ticket.deleteMany({ where: { tenantId: tenantA } });
        await admin.ticketTemplateAutomationActivation.deleteMany({
          where: { tenantId: tenantA },
        });
        await admin.ticketTemplate.deleteMany({ where: { tenantId: tenantA } });
        await admin.$executeRawUnsafe(
          "TRUNCATE wallet_ledger_entries, wallet_transactions, wallet_accounts",
        );
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
        await admin.tour.deleteMany({ where: { id: tourId } });
        await admin.$executeRawUnsafe(
          "ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only",
        );
        try {
          await admin.auditEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        } finally {
          await admin.$executeRawUnsafe(
            "ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only",
          );
        }
        await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      } finally {
        await admin.$disconnect();
        await disconnectPrisma();
      }
    });

    beforeEach(async () => {
      await quiesceStaleOutboxProcessing(0);
    });

    async function relayUntilOutboxDone(outboxId: string): Promise<void> {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await processOutboxRelayForTenantOnce(tenantA, 50);
        const row = await admin.outboxEvent.findUnique({ where: { id: outboxId } });
        if (row?.status === "done") {
          return;
        }
      }
      const stuck = await admin.outboxEvent.findUnique({ where: { id: outboxId } });
      assert.fail(`outbox ${outboxId} not done: ${JSON.stringify(stuck)}`);
    }

    async function assertOutboxDone(outboxId: string): Promise<void> {
      const row = await admin.outboxEvent.findUnique({ where: { id: outboxId } });
      assert.equal(row?.status, "done");
      assert.ok(row?.processedAt);
    }

    async function assertSingleInboxRow(input: {
      readonly userId: string;
      readonly dedupeKey: string;
      readonly eventType: string;
    }): Promise<{ id: string }> {
      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: input.userId,
        limit: 50,
      });
      const matches = list.items.filter((item) => item.dedupeKey === input.dedupeKey);
      assert.equal(
        matches.length,
        1,
        `expected one inbox row for ${input.eventType} dedupe=${input.dedupeKey}`,
      );
      assert.equal(matches[0]!.eventType, input.eventType);
      return { id: matches[0]!.id };
    }

    async function assertMarkReadViaHttp(
      notificationId: string,
      userId: string,
    ): Promise<void> {
      const mark = await requestJson(listener, {
        method: "PATCH",
        path: `/member/notifications/${notificationId}/read`,
        tenantId: tenantA,
        userId,
        role: "member",
      });
      assert.equal(mark.status, 200, JSON.stringify(mark.body));
      const persisted = await findMemberNotificationById(tenantA, notificationId);
      assert.ok(persisted?.readAt);
      const reload = await listMemberNotifications({
        tenantId: tenantA,
        userId,
        limit: 20,
      });
      const row = reload.items.find((item) => item.id === notificationId);
      assert.ok(row?.readAt, "readAt must persist after reload");
    }

    async function createApprovedRegistrationForMember(
      userId = randomUUID(),
    ): Promise<{ bookingId: string; memberId: string }> {
      const create = await requestJson(listener, {
        method: "POST",
        path: "/bookings",
        tenantId: tenantA,
        userId: operatorId,
        body: {
          tourId,
          tourTitle: "MNI Data-Backed Tour",
          guestLabel: `Guest-${randomUUID().slice(0, 8)}`,
          partySize: 1,
          departureAt: new Date(Date.now() + 86_400_000).toISOString(),
          registrationIntake: { tourCapacityMax: 20 },
        },
      });
      assert.equal(create.status, 201, JSON.stringify(create.body));
      const bookingId = create.body.id as string;
      await admin.operatorRegistration.update({
        where: { id: bookingId },
        data: { submittedByUserId: userId },
      });
      const approve = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${bookingId}/approve`,
        tenantId: tenantA,
        userId: operatorId,
      });
      assert.equal(approve.status, 200, JSON.stringify(approve.body));

      const pending = await admin.outboxEvent.findFirst({
        where: {
          tenantId: tenantA,
          aggregateId: bookingId,
          eventType: "registration.approved",
          status: "pending",
        },
      });
      assert.ok(pending);
      await relayUntilOutboxDone(pending.id);

      return { bookingId, memberId: userId };
    }

    it("J1 ticket.created — POST /member/tickets → outbox → relay → inbox → mark read", async () => {
      const idempotencyKey = `mni-ticket-${randomUUID()}`;
      const create = await requestJson(listener, {
        method: "POST",
        path: "/member/tickets",
        tenantId: tenantA,
        userId: memberUser,
        role: "member",
        idempotencyKey,
        body: {
          categoryCode: "billing",
          subject: "Data-backed ticket",
          body: "Need help",
        },
      });
      assert.equal(create.status, 201, JSON.stringify(create.body));
      const envelope = create.body.ticket as Record<string, unknown>;
      const summary = envelope.ticket as Record<string, unknown>;
      const ticketId = summary.id as string;

      const pending = await admin.outboxEvent.findMany({
        where: {
          tenantId: tenantA,
          aggregateId: ticketId,
          eventType: "ticket.created",
          status: "pending",
        },
      });
      assert.equal(pending.length, 1);
      const domainEventId = pending[0]!.domainEventId;

      await relayUntilOutboxDone(pending[0]!.id);
      await assertOutboxDone(pending[0]!.id);

      const relay2 = await processOutboxRelayForTenantOnce(tenantA, 50);
      assert.equal(relay2.published, 0);

      const inbox = await assertSingleInboxRow({
        userId: memberUser,
        dedupeKey: domainEventId,
        eventType: "ticket.created",
      });

      const apiList = await requestJson(listener, {
        method: "GET",
        path: "/member/notifications?limit=20",
        tenantId: tenantA,
        userId: memberUser,
        role: "member",
      });
      assert.equal(apiList.status, 200);
      const items = apiList.body.items as Array<Record<string, unknown>>;
      assert.ok(items.some((item) => item.id === inbox.id));

      await assertMarkReadViaHttp(inbox.id, memberUser);
    });

    it("J2 registration.approved — booking approve → outbox → relay → inbox", async () => {
      const create = await requestJson(listener, {
        method: "POST",
        path: "/bookings",
        tenantId: tenantA,
        userId: operatorId,
        body: {
          tourId,
          tourTitle: "MNI Data-Backed Tour",
          guestLabel: `Reg-${randomUUID().slice(0, 8)}`,
          partySize: 1,
          departureAt: new Date(Date.now() + 86_400_000).toISOString(),
          registrationIntake: { tourCapacityMax: 20 },
        },
      });
      assert.equal(create.status, 201);
      const bookingId = create.body.id as string;
      await admin.operatorRegistration.update({
        where: { id: bookingId },
        data: { submittedByUserId: memberUser },
      });

      const approve = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${bookingId}/approve`,
        tenantId: tenantA,
        userId: operatorId,
      });
      assert.equal(approve.status, 200);

      const pending = await admin.outboxEvent.findFirst({
        where: {
          tenantId: tenantA,
          aggregateId: bookingId,
          eventType: "registration.approved",
          status: "pending",
        },
      });
      assert.ok(pending);
      await relayUntilOutboxDone(pending.id);
      await assertOutboxDone(pending.id);

      const inbox = await assertSingleInboxRow({
        userId: memberUser,
        dedupeKey: pending.domainEventId,
        eventType: "registration.approved",
      });
      await assertMarkReadViaHttp(inbox.id, memberUser);
    });

    it("J2b payment.hold.scheduled — approve with payable quote → durable outbox → relay → inbox", async () => {
      const memberId = randomUUID();
      const create = await requestJson(listener, {
        method: "POST",
        path: "/bookings",
        tenantId: tenantA,
        userId: operatorId,
        body: {
          tourId,
          tourTitle: "MNI Data-Backed Tour",
          guestLabel: `Hold-${randomUUID().slice(0, 8)}`,
          partySize: 1,
          departureAt: new Date(Date.now() + 86_400_000).toISOString(),
          registrationIntake: { tourCapacityMax: 20 },
        },
      });
      assert.equal(create.status, 201);
      const bookingId = create.body.id as string;
      await admin.operatorRegistration.update({
        where: { id: bookingId },
        data: { submittedByUserId: memberId },
      });

      const approve = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${bookingId}/approve`,
        tenantId: tenantA,
        userId: operatorId,
      });
      assert.equal(approve.status, 200, JSON.stringify(approve.body));
      assert.equal(typeof approve.body.paymentDueAt, "string");

      const holdOutbox = await admin.outboxEvent.findFirst({
        where: {
          tenantId: tenantA,
          aggregateId: bookingId,
          eventType: "payment.hold.scheduled",
          status: "pending",
        },
      });
      assert.ok(holdOutbox, "approve must persist payment.hold.scheduled in prisma outbox");

      await relayUntilOutboxDone(holdOutbox.id);
      await assertOutboxDone(holdOutbox.id);

      const inbox = await assertSingleInboxRow({
        userId: memberId,
        dedupeKey: holdOutbox.domainEventId,
        eventType: "payment.hold.scheduled",
      });
      await assertMarkReadViaHttp(inbox.id, memberId);
    });

    it("J3 payment.confirmed — prepayment on approved registration → ledger outbox → inbox", async () => {
      const { bookingId, memberId } = await createApprovedRegistrationForMember();

      const prepay = await requestJson(listener, {
        method: "POST",
        path: "/finance/prepayments",
        tenantId: tenantA,
        userId: operatorId,
        idempotencyKey: `mni-prepay-${bookingId}`,
        body: {
          registrationId: bookingId,
          amountMinor: "500000",
          currency: "IRR",
          method: "Manual",
        },
      });
      assert.equal(prepay.status, 201, JSON.stringify(prepay.body));

      const pending = await admin.outboxEvent.findFirst({
        where: {
          tenantId: tenantA,
          eventType: "finance.ledger.double_entry_applied",
          status: "pending",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(pending, "prepayment must enqueue ledger capture outbox");

      await relayUntilOutboxDone(pending.id);
      await assertOutboxDone(pending.id);

      const inbox = await assertSingleInboxRow({
        userId: memberId,
        dedupeKey: pending.domainEventId,
        eventType: "payment.confirmed",
      });
      await assertMarkReadViaHttp(inbox.id, memberId);
    });

    it("J4 wallet.transaction.posted — operatorCredit → outbox → relay → inbox", async () => {
      const account = await runWithTenantContext(
        tenantA,
        () =>
          walletRepo.getOrCreateAccount({
            tenantId: tenantA,
            workspaceId: "ws-mni-data-backed",
            userId: memberUser,
            currency: "IRR",
          }),
        { actorId: operatorId },
      );
      assert.equal(account.ok, true);
      if (!account.ok) return;

      const credit = await runWithTenantContext(
        tenantA,
        () =>
          walletRepo.operatorCredit({
            tenantId: tenantA,
            workspaceId: "ws-mni-data-backed",
            userId: memberUser,
            accountId: account.value.id,
            amountMinor: "1200",
            currency: "IRR",
            creationIdempotencyKey: `mni-wallet-${randomUUID()}`,
            reference: null,
            actor: { actorUserId: operatorId, actorRole: "operator" },
          }),
        { actorId: operatorId },
      );
      assert.equal(credit.ok, true);
      if (!credit.ok) return;

      const pending = await admin.outboxEvent.findFirst({
        where: {
          tenantId: tenantA,
          aggregateId: credit.value.transaction.id,
          eventType: "wallet.transaction.posted",
          status: "pending",
        },
      });
      assert.ok(pending);

      await relayUntilOutboxDone(pending.id);
      await assertOutboxDone(pending.id);

      const inbox = await assertSingleInboxRow({
        userId: memberUser,
        dedupeKey: pending.domainEventId,
        eventType: "wallet.transaction.posted",
      });
      await assertMarkReadViaHttp(inbox.id, memberUser);
    });

    it("J5 engagement.badge.earned — registration.approved relay awards badge notification", async () => {
      const memberId = randomUUID();
      await createApprovedRegistrationForMember(memberId);

      const engagement = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberId,
        sourceModule: "engagement",
        limit: 20,
      });
      assert.ok(
        engagement.items.some((item) => item.eventType === "engagement.badge.earned"),
        "registration.approved relay must award engagement badge notification",
      );
    });

    it("J6 tour.schedule.changed — updateTour schedule mutation fans out to approved member", async () => {
      const memberId = randomUUID();
      await createApprovedRegistrationForMember(memberId);

      const tour = await admin.tour.findUniqueOrThrow({ where: { id: tourId } });
      const toursService = createTestToursService(new PrismaTourRepository());
      const beforeData = (tour.canonical as { data: Record<string, unknown> }).data;

      await runWithTenantContext(
        tenantA,
        async () => {
          await toursService.updateTour(ownerAuth, tourId, {
            rowVersion: tour.rowVersion,
            data: {
              startDateTime: "2026-12-01T08:00:00.000Z",
              basicInfo: {
                ...((beforeData.basicInfo as Record<string, unknown> | undefined) ?? {}),
                startDateTime: "2026-12-01T08:00:00.000Z",
              },
            },
          });
        },
        { actorId: operatorId },
      );

      const pending = await admin.outboxEvent.findFirst({
        where: {
          tenantId: tenantA,
          aggregateId: tourId,
          eventType: "tour.mutation.notification_required",
          status: "pending",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(pending, "schedule change must enqueue tour mutation outbox");

      await relayUntilOutboxDone(pending.id);
      await assertOutboxDone(pending.id);

      const inbox = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberId,
        limit: 20,
      });
      const matches = inbox.items.filter(
        (item) =>
          item.eventType === "tour.schedule.changed" &&
          item.dedupeKey.startsWith(`${pending.domainEventId}:`),
      );
      assert.equal(matches.length, 1, "tour schedule fan-out must create one row per member");
      await assertMarkReadViaHttp(matches[0]!.id, memberId);
    });

    it("S1 empty inbox returns zero unread for member with no notifications", async () => {
      const freshMember = randomUUID();
      const count = await countUnreadMemberNotifications({
        tenantId: tenantA,
        userId: freshMember,
      });
      assert.equal(count, 0);
      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: freshMember,
        limit: 20,
      });
      assert.equal(list.items.length, 0);
    });

    it("S2 failed SMS delivery when SMS_ENABLED=false", async () => {
      const memberId = randomUUID();
      await createApprovedRegistrationForMember(memberId);

      const notification = await admin.memberNotification.findFirst({
        where: { tenantId: tenantA, userId: memberId, eventType: "registration.approved" },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(notification);

      const delivery = await admin.memberNotificationDelivery.create({
        data: {
          tenantId: tenantA,
          notificationId: notification.id,
          channel: "sms",
          provider: "noop",
          status: "pending",
          nextAttemptAt: new Date(),
        },
      });

      const result = await processTicketNotificationDeliveriesForTenantOnce(tenantA, 5);
      assert.ok(result.failed >= 1);

      const updated = await admin.memberNotificationDelivery.findUnique({
        where: { id: delivery.id },
      });
      assert.equal(updated?.status, "failed");
    });

    it("S3 retryable delivery stays pending with next_attempt_at", async () => {
      const notification = await admin.memberNotification.create({
        data: {
          tenantId: tenantA,
          userId: memberUser,
          sourceModule: "booking",
          eventType: "registration.approved",
          entityType: "registration",
          entityId: randomUUID(),
          title: "retry-test",
          body: "retry-test",
          dedupeKey: `retry:${randomUUID()}`,
        },
      });
      const delivery = await admin.memberNotificationDelivery.create({
        data: {
          tenantId: tenantA,
          notificationId: notification.id,
          channel: "email",
          provider: "noop",
          status: "pending",
          nextAttemptAt: new Date(),
        },
      });

      await markMemberNotificationDeliveryResult(tenantA, delivery.id, {
        ok: false,
        retryable: true,
        error: "TRANSIENT",
      });

      const updated = await admin.memberNotificationDelivery.findUnique({
        where: { id: delivery.id },
      });
      assert.equal(updated?.status, "pending");
      assert.ok(updated?.nextAttemptAt);
      assert.equal(updated?.processedAt, null);
    });

    it("S4 permission denied — member B cannot mark member A notification read", async () => {
      const memberId = randomUUID();
      await createApprovedRegistrationForMember(memberId);

      const inbox = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberId,
        limit: 5,
      });
      const row = inbox.items[0];
      assert.ok(row);

      const denied = await requestJson(listener, {
        method: "PATCH",
        path: `/member/notifications/${row.id}/read`,
        tenantId: tenantA,
        userId: memberB,
        role: "member",
      });
      assert.equal(denied.status, 404);
    });

    it("S5 cross-tenant — tenant B member cannot list tenant A notifications", async () => {
      const list = await listMemberNotifications({
        tenantId: tenantB,
        userId: memberUser,
        limit: 20,
      });
      assert.equal(list.items.length, 0);
    });
  },
);
