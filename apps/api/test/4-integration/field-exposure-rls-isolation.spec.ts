/**
 * 4-integration — exposure reminder RLS tenant isolation (Phase 9.3).
 *
 * Run:
 *   DATABASE_URL='postgresql://...' STORAGE_DRIVER=prisma NODE_ENV=test \
 *     pnpm --filter @apps/api run test:exposure:integration
 *
 * @see docs/architecture/field-exposure-system.md — Phase 9.3
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import type { PrismaClient } from "@prisma/client";

import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { listDenaliReminderActivations } from "../../src/exposure/denali-reminder-activation.repository";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

describe(
  "4-integration — field exposure RLS isolation",
  {
    skip: hasDatabase
      ? false
      : "DATABASE_URL required — Postgres RLS for reminder activations (see apps/api/.env.example)",
    concurrency: false,
  },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = randomUUID();
    const tourId = randomUUID();
    let admin: PrismaClient;

    before(async () => {
      await disconnectPrisma();
      admin = getPrismaAdmin();

      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `exposure-rls-a-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
          },
          {
            id: tenantB,
            subdomain: `exposure-rls-b-${tenantB.slice(0, 8)}`,
            workspaceType: "denali",
          },
        ],
      });

      await admin.denaliExposureReminderActivation.create({
        data: {
          tenantId: tenantA,
          tourId,
          reminderOffset: "-48h",
          anchorAt: new Date("2026-06-01T10:00:00.000Z"),
        },
      });
    });

    after(async () => {
      await admin.denaliExposureReminderActivation.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      await disconnectPrisma();
    });

    it("hides reminder activations from other tenants under RLS", async () => {
      const foreignView = await listDenaliReminderActivations({ tenantId: tenantB, limit: 50 });
      assert.equal(foreignView.length, 0);

      const ownView = await listDenaliReminderActivations({ tenantId: tenantA, limit: 50 });
      assert.equal(ownView.length, 1);
      assert.equal(ownView[0]?.tourId, tourId);
    });
  },
);
