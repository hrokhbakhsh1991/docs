/**
 * Ticketing orphan attachment cleanup worker — Phase L closure.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { disconnectPrisma, getPrisma } from "../src/db/prisma";
import { processTicketOrphanAttachmentsOnce } from "../src/workspace-ticketing/process-ticket-orphan-attachments-once";
import { assertPostgresAppRoleForRlsTests } from "../src/workspace-ticketing/ticketing-postgres-test-helpers";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

const postgresSkip = !hasDatabase
  ? "TICKET_ORPHAN_ATTACHMENT_POSTGRES_REQUIRES_DATABASE"
  : process.env.STORAGE_DRIVER?.trim().toLowerCase() !== "prisma"
    ? "TICKET_ORPHAN_ATTACHMENT_POSTGRES_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

describe(
  "ticket-orphan-attachments.postgres.spec.ts — orphan attachment cleanup worker",
  { concurrency: false, skip: postgresSkip },
  () => {
    const tenantId = randomUUID();
    const ticketId = randomUUID();
    let admin: PrismaClient;
    let previousWorkerFlag: string | undefined;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      previousWorkerFlag = process.env.TICKETING_ORPHAN_ATTACHMENT_WORKER_ENABLED;
      process.env.TICKETING_ORPHAN_ATTACHMENT_WORKER_ENABLED = "1";
      await assertPostgresAppRoleForRlsTests(getPrisma());
      const adminUrl = process.env.DATABASE_URL_ADMIN?.trim();
      if (!adminUrl) throw new Error("DATABASE_URL_ADMIN required");
      admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `tkt-orph-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: { enabledModules: ["ticketing"] },
        },
      });
      await admin.ticket.create({
        data: {
          id: ticketId,
          tenantId,
          requesterUserId: randomUUID(),
          categoryCode: "billing",
          priority: "normal",
          status: "open",
          subject: "Orphan intent ticket",
          ticketNumber: 9101,
          lastActivityAt: new Date(),
        },
      });
    });

    after(async () => {
      try {
        await admin.ticketAttachment.deleteMany({ where: { tenantId } });
        await admin.ticket.deleteMany({ where: { tenantId } });
        await admin.tenant.delete({ where: { id: tenantId } });
      } finally {
        if (previousWorkerFlag === undefined) {
          delete process.env.TICKETING_ORPHAN_ATTACHMENT_WORKER_ENABLED;
        } else {
          process.env.TICKETING_ORPHAN_ATTACHMENT_WORKER_ENABLED = previousWorkerFlag;
        }
        await admin.$disconnect();
        await disconnectPrisma();
      }
    });

    it("removes expired upload intents", async () => {
      const attachmentId = randomUUID();
      const expiredAt = new Date(Date.now() - 60_000);
      await admin.ticketAttachment.create({
        data: {
          id: attachmentId,
          tenantId,
          ticketId,
          uploadedByUserId: randomUUID(),
          objectKey: `tickets/${tenantId}/${ticketId}/pending/${attachmentId}`,
          originalFileName: "orphan.bin",
          contentType: "application/pdf",
          sizeBytes: 1,
          uploadIntentExpiresAt: expiredAt,
        },
      });

      const result = await processTicketOrphanAttachmentsOnce();
      assert.ok(result.expiredIntentsRemoved >= 1);
      const remaining = await admin.ticketAttachment.findUnique({ where: { id: attachmentId } });
      assert.equal(remaining, null);
    });
  },
);
