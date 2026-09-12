/**
 * Ticketing retention purge worker — Phase L closure.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { disconnectPrisma, getPrisma } from "../src/db/prisma";
import { processTicketRetentionOnce } from "../src/workspace-ticketing/process-ticket-retention-once";
import { retentionCutoffIso } from "../src/workspace-ticketing/ticket-retention-policy";
import { assertPostgresAppRoleForRlsTests } from "../src/workspace-ticketing/ticketing-postgres-test-helpers";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

const postgresSkip = !hasDatabase
  ? "TICKET_RETENTION_POSTGRES_REQUIRES_DATABASE"
  : process.env.STORAGE_DRIVER?.trim().toLowerCase() !== "prisma"
    ? "TICKET_RETENTION_POSTGRES_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

describe(
  "ticket-retention.postgres.spec.ts — retention purge worker",
  { concurrency: false, skip: postgresSkip },
  () => {
    const tenantId = randomUUID();
    let admin: PrismaClient;
    let previousWorkerFlag: string | undefined;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      previousWorkerFlag = process.env.TICKETING_RETENTION_WORKER_ENABLED;
      process.env.TICKETING_RETENTION_WORKER_ENABLED = "1";
      await assertPostgresAppRoleForRlsTests(getPrisma());
      const adminUrl = process.env.DATABASE_URL_ADMIN?.trim();
      if (!adminUrl) throw new Error("DATABASE_URL_ADMIN required");
      admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `tkt-ret-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: { enabledModules: ["ticketing"] },
        },
      });
      await admin.ticketWorkspaceSettings.create({
        data: {
          tenantId,
          slaDefaults: { retentionDays: 30, attachmentRetentionDays: 30 },
        },
      });
    });

    after(async () => {
      try {
        await admin.ticket.deleteMany({ where: { tenantId } });
        await admin.ticketWorkspaceSettings.deleteMany({ where: { tenantId } });
        await admin.tenant.delete({ where: { id: tenantId } });
      } finally {
        if (previousWorkerFlag === undefined) {
          delete process.env.TICKETING_RETENTION_WORKER_ENABLED;
        } else {
          process.env.TICKETING_RETENTION_WORKER_ENABLED = previousWorkerFlag;
        }
        await admin.$disconnect();
        await disconnectPrisma();
      }
    });

    it("purges closed tickets older than retentionDays", async () => {
      const staleClosedAt = new Date(retentionCutoffIso(30));
      staleClosedAt.setUTCDate(staleClosedAt.getUTCDate() - 1);
      const ticketId = randomUUID();
      await admin.ticket.create({
        data: {
          id: ticketId,
          tenantId,
          requesterUserId: randomUUID(),
          categoryCode: "billing",
          priority: "normal",
          status: "closed",
          subject: "Stale closed ticket",
          ticketNumber: 9001,
          lastActivityAt: staleClosedAt,
          closedAt: staleClosedAt,
          updatedAt: staleClosedAt,
        },
      });

      const result = await processTicketRetentionOnce();
      assert.ok(result.ticketsPurged >= 1);
      const remaining = await admin.ticket.findUnique({
        where: { tenantId_id: { tenantId, id: ticketId } },
      });
      assert.equal(remaining, null);
    });
  },
);
