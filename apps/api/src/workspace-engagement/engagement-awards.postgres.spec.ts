/**
 * MEG-001 — engagement award processors (profile + registration outbox).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { BOOKING_APPROVE_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { integrationTenantId } from "../../test/test-helpers";
import { createPrismaEngagementRepository } from "./infrastructure/prisma-engagement.repository";
import {
  dispatchEngagementFromOutbox,
  processEngagementAward,
  processProfileEngagementAward,
} from "./process-engagement-awards";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) &&
  Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const hasPrismaDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase() === "prisma";

const postgresSkip = !hasDatabase
  ? "ENGAGEMENT_AWARDS_REQUIRES_DATABASE"
  : !hasPrismaDriver
    ? "ENGAGEMENT_AWARDS_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

describe(
  "engagement-awards.postgres.spec.ts — MEG-001",
  { skip: postgresSkip, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    const userId = randomUUID();
    const workspaceId = "denali";
    const repo = createPrismaEngagementRepository();
    const priorDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      const admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `eng-awards-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      const admin = getPrismaAdmin();
      await admin.$executeRawUnsafe(
        "TRUNCATE member_engagement_badges, engagement_point_events, engagement_profiles",
      );
      await admin.tenant.delete({ where: { id: tenantId } });
      await disconnectPrisma();
    });

    it("awards profile.completed once per user", async () => {
      await runWithTenantContext(tenantId, async () => {
        await processProfileEngagementAward(
          { tenantId, userId, role: "member", workspaceId: "ws-test" },
          true,
        );
        await processProfileEngagementAward(
          { tenantId, userId, role: "member", workspaceId: "ws-test" },
          true,
        );
      });

      const profile = await runWithTenantContext(tenantId, () =>
        repo.getOrCreateProfile(tenantId, workspaceId, userId),
      );
      assert.equal(profile.totalPoints, 50);

      const events = await runWithTenantContext(tenantId, () =>
        repo.listPointEventsForUser({ tenantId, userId, workspaceId, limit: 10 }),
      );
      assert.equal(events.items.length, 1);
      assert.equal(events.items[0]?.sourceEventType, "profile.completed");
    });

    it("awards registration.first_approved from outbox idempotently", async () => {
      const guestUserId = randomUUID();
      const bookingId = randomUUID();
      const row = {
        tenantId,
        eventType: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
        aggregateId: bookingId,
        payload: { guestUserId, bookingId },
      };

      await dispatchEngagementFromOutbox(row);
      await dispatchEngagementFromOutbox(row);

      const profile = await runWithTenantContext(tenantId, () =>
        repo.getOrCreateProfile(tenantId, workspaceId, guestUserId),
      );
      assert.equal(profile.totalPoints, 100);

      const events = await runWithTenantContext(tenantId, () =>
        repo.listPointEventsForUser({
          tenantId,
          userId: guestUserId,
          workspaceId,
          limit: 10,
        }),
      );
      assert.equal(events.items.length, 1);
      assert.equal(events.items[0]?.sourceEventType, "registration.first_approved");
    });

    it("ignores unknown event types without pointsOverride", async () => {
      const targetUserId = randomUUID();
      await processEngagementAward({
        tenantId,
        workspaceId,
        userId: targetUserId,
        eventType: "attendance.verified",
        sourceModule: "booking",
        dedupeKey: `engagement:test:missing:${targetUserId}`,
      });

      const profile = await runWithTenantContext(tenantId, () =>
        repo.getOrCreateProfile(tenantId, workspaceId, targetUserId),
      );
      assert.equal(profile.totalPoints, 0);
    });
  },
);
