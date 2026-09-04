/**
 * MNI-ADV — adversarial Postgres proofs for shared notification platform.
 * Real outbox → relay → inbox; no direct insertMemberNotificationRow as sole proof.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrisma, getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import { enqueueOutboxEvent } from "../outbox/enqueue-domain-event";
import { processOutboxRelayForTenantOnce } from "../outbox/outbox-relay";
import {
  countUnreadMemberNotifications,
  listMemberNotifications,
  markAllMemberNotificationsRead,
  markMemberNotificationRead,
} from "./member-notification.repository";
import { integrationTenantId } from "../../test/test-helpers";
import { assertPostgresAppRoleForRlsTests } from "../workspace-ticketing/ticketing-postgres-test-helpers";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const hasPrismaDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase() === "prisma";
const postgresSkip = !hasDatabase
  ? "MNI_ADVERSARIAL_REQUIRES_DATABASE"
  : !hasPrismaDriver
    ? "MNI_ADVERSARIAL_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

const PERSIAN_LONG =
  "اطلاعیه مهم: زمان حرکت تور «کوهستان البرز» به دلیل شرایط جوی به ساعت ۰۶:۳۰ تغییر یافت. لطفاً ۴۵ دقیقه زودتر در محل تجمع حاضر شوید.";

describe(
  "member-notification-adversarial.postgres.spec.ts — MNI-ADV",
  { skip: postgresSkip, concurrency: false },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const memberA = randomUUID();
    const memberB = randomUUID();
    const priorDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      await assertPostgresAppRoleForRlsTests(getPrisma());
      const admin = getPrismaAdmin();
      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `mni-adv-a-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing", "wallet", "engagement"] },
          },
          {
            id: tenantB,
            subdomain: `mni-adv-b-${tenantB.slice(0, 8)}`,
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
        await admin.memberNotificationDelivery.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.memberNotification.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.outboxEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.operatorRegistration.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.$executeRawUnsafe(
          "ALTER TABLE engagement_point_events DISABLE TRIGGER engagement_point_events_append_only",
        );
        try {
          await admin.engagementPointEvent.deleteMany({
            where: { tenantId: { in: [tenantA, tenantB] } },
          });
          await admin.memberEngagementBadge.deleteMany({
            where: { tenantId: { in: [tenantA, tenantB] } },
          });
          await admin.engagementProfile.deleteMany({
            where: { tenantId: { in: [tenantA, tenantB] } },
          });
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

    it("duplicate relay does not duplicate payment.confirmed inbox row", async () => {
      const domainEventId = `payment:${randomUUID()}:ledger-capture-anchor`;

      await withTenantRls(tenantA, async (tx) => {
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "FinanceLedger",
          aggregateId: randomUUID(),
          eventType: "finance.ledger.double_entry_applied",
          domainEventId,
          payload: {
            registrationId: randomUUID(),
            guestUserId: memberA,
            journalId: randomUUID(),
          },
        });
      });

      await processOutboxRelayForTenantOnce(tenantA, 20);
      await processOutboxRelayForTenantOnce(tenantA, 20);

      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberA,
        sourceModule: "finance",
        limit: 20,
      });
      const matches = list.items.filter(
        (item) => item.eventType === "payment.confirmed" && item.dedupeKey === domainEventId,
      );
      assert.equal(matches.length, 1);
    });

    it("tenant B cannot list tenant A notifications via member scope", async () => {
      const domainEventId = `payment:${randomUUID()}:ledger-capture-anchor`;

      await withTenantRls(tenantA, async (tx) => {
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "FinanceLedger",
          aggregateId: randomUUID(),
          eventType: "finance.ledger.double_entry_applied",
          domainEventId,
          payload: {
            registrationId: randomUUID(),
            guestUserId: memberA,
            journalId: randomUUID(),
          },
        });
      });
      await processOutboxRelayForTenantOnce(tenantA, 20);

      const crossTenant = await listMemberNotifications({
        tenantId: tenantB,
        userId: memberA,
        limit: 20,
      });
      assert.equal(crossTenant.items.length, 0);
    });

    it("mark-all-read clears unread count and persists after reload", async () => {
      const registrationId = randomUUID();
      const domainEventId = `registration.approved:${registrationId}:${Date.now()}`;

      await withTenantRls(tenantA, async (tx) => {
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "registration",
          aggregateId: registrationId,
          eventType: "registration.approved",
          domainEventId,
          payload: {
            guestUserId: memberA,
            registrationId,
            bookingId: registrationId,
          },
        });
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "registration",
          aggregateId: randomUUID(),
          eventType: "registration.waitlisted",
          domainEventId: `registration.waitlisted:${randomUUID()}`,
          payload: {
            guestUserId: memberA,
            registrationId: randomUUID(),
          },
        });
      });
      await processOutboxRelayForTenantOnce(tenantA, 20);

      const beforeUnread = await countUnreadMemberNotifications({
        tenantId: tenantA,
        userId: memberA,
      });
      assert.ok(beforeUnread >= 2);

      const updated = await markAllMemberNotificationsRead({
        tenantId: tenantA,
        userId: memberA,
      });
      assert.ok(updated >= 2);

      const afterUnread = await countUnreadMemberNotifications({
        tenantId: tenantA,
        userId: memberA,
      });
      assert.equal(afterUnread, 0);

      const reloaded = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberA,
        limit: 20,
      });
      assert.ok(reloaded.items.every((item) => item.readAt !== null));
    });

    it("mark-read persists for single notification", async () => {
      const registrationId = randomUUID();
      const domainEventId = `registration.cancelled:${registrationId}:${Date.now()}`;

      await withTenantRls(tenantA, async (tx) => {
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "registration",
          aggregateId: registrationId,
          eventType: "registration.cancelled",
          domainEventId,
          payload: {
            guestUserId: memberA,
            registrationId,
          },
        });
      });
      await processOutboxRelayForTenantOnce(tenantA, 20);

      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberA,
        sourceModule: "booking",
        limit: 10,
      });
      const row = list.items.find((item) => item.dedupeKey === domainEventId);
      assert.ok(row);

      const marked = await markMemberNotificationRead({
        tenantId: tenantA,
        notificationId: row!.id,
        userId: memberA,
      });
      assert.ok(marked?.readAt);

      const reload = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberA,
        sourceModule: "booking",
        limit: 10,
      });
      const persisted = reload.items.find((item) => item.id === row!.id);
      assert.ok(persisted?.readAt);
    });

    it("stores Persian long text via registration.approved template keys", async () => {
      const registrationId = randomUUID();
      const domainEventId = `registration.approved:fa:${registrationId}`;

      await withTenantRls(tenantA, async (tx) => {
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "registration",
          aggregateId: registrationId,
          eventType: "registration.approved",
          domainEventId,
          payload: {
            guestUserId: memberA,
            registrationId,
            localizedBodyFa: PERSIAN_LONG,
          },
        });
      });
      await processOutboxRelayForTenantOnce(tenantA, 20);

      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberA,
        sourceModule: "booking",
        limit: 10,
      });
      const row = list.items.find((item) => item.dedupeKey === domainEventId);
      assert.ok(row);
      const payload = row!.payload as Record<string, unknown>;
      assert.equal(payload.localizedBodyFa, PERSIAN_LONG);
    });

    it("member B does not receive member A registration notification", async () => {
      const registrationId = randomUUID();
      const domainEventId = `registration.approved:isolation:${registrationId}`;

      await withTenantRls(tenantA, async (tx) => {
        await enqueueOutboxEvent(tx, {
          tenantId: tenantA,
          aggregateType: "registration",
          aggregateId: registrationId,
          eventType: "registration.approved",
          domainEventId,
          payload: {
            guestUserId: memberA,
            registrationId,
          },
        });
      });
      await processOutboxRelayForTenantOnce(tenantA, 20);

      const memberBList = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberB,
        limit: 20,
      });
      assert.equal(
        memberBList.items.some((item) => item.dedupeKey === domainEventId),
        false,
      );
    });
  },
);
