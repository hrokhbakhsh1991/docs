/**
 * MEG-001 — engagement persistence, RLS, idempotency (Postgres required).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { integrationTenantId } from "../../test/test-helpers";
import { createPrismaEngagementRepository } from "./infrastructure/prisma-engagement.repository";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) &&
  Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const hasPrismaDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase() === "prisma";

const postgresSkip = !hasDatabase
  ? "ENGAGEMENT_PERSISTENCE_REQUIRES_DATABASE"
  : !hasPrismaDriver
    ? "ENGAGEMENT_PERSISTENCE_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

describe(
  "engagement-persistence.postgres.spec.ts — MEG-001",
  { skip: postgresSkip, concurrency: false },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const workspaceId = "denali";
    const userA = randomUUID();
    const userB = randomUUID();
    const repo = createPrismaEngagementRepository();
    const priorDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      const admin = getPrismaAdmin();
      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `eng-a-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
            theme: {},
          },
          {
            id: tenantB,
            subdomain: `eng-b-${tenantB.slice(0, 8)}`,
            workspaceType: "denali",
            theme: {},
          },
        ],
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      const admin = getPrismaAdmin();
      await admin.$executeRawUnsafe(
        "TRUNCATE member_engagement_badges, engagement_point_events, engagement_profiles",
      );
      await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      await disconnectPrisma();
    });

    it("awards points idempotently and updates profile totals", async () => {
      const dedupeKey = `engagement:test:${randomUUID()}`;
      const first = await runWithTenantContext(tenantA, () =>
        repo.awardPoints({
          tenantId: tenantA,
          workspaceId,
          userId: userA,
          pointsDelta: 50,
          sourceModule: "identity",
          sourceEventType: "profile.completed",
          dedupeKey,
        }),
      );
      assert.equal(first.replay, false);
      assert.equal(first.profile.totalPoints, 50);
      assert.ok(first.event);

      const second = await runWithTenantContext(tenantA, () =>
        repo.awardPoints({
          tenantId: tenantA,
          workspaceId,
          userId: userA,
          pointsDelta: 50,
          sourceModule: "identity",
          sourceEventType: "profile.completed",
          dedupeKey,
        }),
      );
      assert.equal(second.replay, true);
      assert.equal(second.profile.totalPoints, 50);
    });

    it("denies cross-tenant reads under RLS", async () => {
      const dedupeKey = `engagement:rls:${randomUUID()}`;
      await runWithTenantContext(tenantA, () =>
        repo.awardPoints({
          tenantId: tenantA,
          workspaceId,
          userId: userA,
          pointsDelta: 25,
          sourceModule: "booking",
          sourceEventType: "registration.first_approved",
          dedupeKey,
        }),
      );

      const visibleInB = await withTenantRls(tenantB, (tx) =>
        tx.engagementPointEvent.findMany({ where: { tenantId: tenantA } }),
      );
      assert.equal(visibleInB.length, 0);
    });

    it("posts reversal as compensating negative event", async () => {
      const dedupeKey = `engagement:rev:${randomUUID()}`;
      const award = await runWithTenantContext(tenantA, () =>
        repo.awardPoints({
          tenantId: tenantA,
          workspaceId,
          userId: userB,
          pointsDelta: 100,
          sourceModule: "booking",
          sourceEventType: "registration.first_approved",
          dedupeKey,
        }),
      );
      assert.ok(award.event);
      const reversal = await runWithTenantContext(tenantA, () =>
        repo.awardPoints({
          tenantId: tenantA,
          workspaceId,
          userId: userB,
          pointsDelta: -100,
          sourceModule: "engagement",
          sourceEventType: "engagement.points.reversed",
          dedupeKey: `engagement:reversal:${randomUUID()}`,
          reversesEventId: award.event!.id,
          reason: "test reversal",
        }),
      );
      assert.equal(reversal.profile.totalPoints, 0);
    });
  },
);
