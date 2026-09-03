/**
 * TKT-001 Phase B1 — ticketing Prisma persistence + RLS integration (Postgres required).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import { integrationTenantId } from "../../test/test-helpers";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const hasPrismaDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase() === "prisma";

const postgresSkip = !hasDatabase
  ? "TICKETING_PERSISTENCE_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN"
  : !hasPrismaDriver
    ? "TICKETING_PERSISTENCE_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

const TICKETING_TABLES = [
  "tickets",
  "ticket_messages",
  "ticket_events",
  "ticket_attachments",
  "ticket_links",
] as const;

function ticketObjectKey(tenantId: string, ticketId: string, fileName: string): string {
  return `tickets/${tenantId}/${ticketId}/${randomUUID()}/${fileName}`;
}

describe(
  "ticketing-persistence.postgres.spec.ts — TKT-001 Phase B1",
  { skip: postgresSkip, concurrency: false },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const requesterA = randomUUID();
    const operatorA = randomUUID();
    let ticketAId = "";
    let messageAId = "";
    let eventAId = "";
    let attachmentAId = "";
    let linkAId = "";
    const priorDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      const admin = getPrismaAdmin();
      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `tkt-a-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
            theme: {},
          },
          {
            id: tenantB,
            subdomain: `tkt-b-${tenantB.slice(0, 8)}`,
            workspaceType: "denali",
            theme: {},
          },
        ],
      });

      const posture = await admin.$queryRaw<
        Array<{ relname: string; rls: boolean; force_rls: boolean }>
      >`
        SELECT c.relname::text AS relname,
               c.relrowsecurity AS rls,
               c.relforcerowsecurity AS force_rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = ANY(${TICKETING_TABLES}::text[])
        ORDER BY 1
      `;
      assert.equal(posture.length, TICKETING_TABLES.length);
      for (const row of posture) {
        assert.equal(row.rls, true, `${row.relname} must ENABLE RLS`);
        assert.equal(row.force_rls, true, `${row.relname} must FORCE RLS`);
      }
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      const admin = getPrismaAdmin();
      try {
        await admin.ticketLink.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.ticketAttachment.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.ticketEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.ticketMessage.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.ticket.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.$executeRawUnsafe(
          "ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only",
        );
        try {
          await admin.auditEvent.deleteMany({
            where: { tenantId: { in: [tenantA, tenantB] } },
          });
        } finally {
          await admin.$executeRawUnsafe(
            "ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only",
          );
        }
        await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      } finally {
        await disconnectPrisma();
      }
    });

    it("creates ticket with required fields, defaults, and indexes", async () => {
      ticketAId = randomUUID();
      const now = new Date();

      await withTenantRls(tenantA, async (tx) => {
        const ticket = await tx.ticket.create({
          data: {
            id: ticketAId,
            tenantId: tenantA,
            requesterUserId: requesterA,
            categoryCode: "billing",
            priority: "normal",
            status: "open",
            subject: "Payment question",
            lastActivityAt: now,
            creationIdempotencyKey: `create-${randomUUID()}`,
          },
        });
        assert.equal(ticket.rowVersion, 1);
        assert.equal(ticket.tenantId, tenantA);
        assert.equal(ticket.requesterUserId, requesterA);
        assert.ok(ticket.createdAt instanceof Date);
        assert.ok(ticket.updatedAt instanceof Date);
      });
    });

    it("creates public message, internal note, event, attachment metadata, and business link", async () => {
      messageAId = randomUUID();
      eventAId = randomUUID();
      attachmentAId = randomUUID();
      linkAId = randomUUID();
      const tourId = randomUUID();

      await withTenantRls(tenantA, async (tx) => {
        const publicMessage = await tx.ticketMessage.create({
          data: {
            id: messageAId,
            tenantId: tenantA,
            ticketId: ticketAId,
            authorUserId: requesterA,
            visibility: "public",
            body: "I need help with my payment.",
            idempotencyKey: `msg-${randomUUID()}`,
          },
        });
        assert.equal(publicMessage.visibility, "public");

        const internalNote = await tx.ticketMessage.create({
          data: {
            tenantId: tenantA,
            ticketId: ticketAId,
            authorUserId: operatorA,
            visibility: "internal",
            body: "Operator-only context",
            idempotencyKey: `note-${randomUUID()}`,
          },
        });
        assert.equal(internalNote.visibility, "internal");

        const event = await tx.ticketEvent.create({
          data: {
            id: eventAId,
            tenantId: tenantA,
            ticketId: ticketAId,
            actorUserId: operatorA,
            eventType: "ticket.created",
            payload: { subject: "Payment question" },
          },
        });
        assert.equal(event.eventType, "ticket.created");

        const attachment = await tx.ticketAttachment.create({
          data: {
            id: attachmentAId,
            tenantId: tenantA,
            ticketId: ticketAId,
            messageId: messageAId,
            uploadedByUserId: requesterA,
            objectKey: ticketObjectKey(tenantA, ticketAId, "receipt.pdf"),
            originalFileName: "receipt.pdf",
            contentType: "application/pdf",
            sizeBytes: 1024,
            checksum: "sha256:abc",
          },
        });
        assert.equal(attachment.messageId, messageAId);

        const link = await tx.ticketLink.create({
          data: {
            id: linkAId,
            tenantId: tenantA,
            ticketId: ticketAId,
            entityType: "tour",
            entityId: tourId,
            metadata: { source: "member_portal" },
          },
        });
        assert.equal(link.entityType, "tour");
      });
    });

    it("rejects invalid status and priority", async () => {
      let rejectedStatus = false;
      try {
        await withTenantRls(tenantA, async (tx) => {
          await tx.$executeRaw`
            INSERT INTO tickets (
              id, tenant_id, requester_user_id, category_code, priority, status, subject, last_activity_at
            ) VALUES (
              ${randomUUID()}::uuid,
              ${tenantA}::uuid,
              ${requesterA}::uuid,
              'billing',
              'normal',
              'invalid_status',
              'Bad status ticket',
              now()
            )
          `;
        });
      } catch {
        rejectedStatus = true;
      }
      assert.equal(rejectedStatus, true, "invalid status must fail CHECK constraint");

      let rejectedPriority = false;
      try {
        await withTenantRls(tenantA, async (tx) => {
          await tx.$executeRaw`
            INSERT INTO tickets (
              id, tenant_id, requester_user_id, category_code, priority, status, subject, last_activity_at
            ) VALUES (
              ${randomUUID()}::uuid,
              ${tenantA}::uuid,
              ${requesterA}::uuid,
              'billing',
              'mega',
              'open',
              'Bad priority ticket',
              now()
            )
          `;
        });
      } catch {
        rejectedPriority = true;
      }
      assert.equal(rejectedPriority, true, "invalid priority must fail CHECK constraint");
    });

    it("rejects tenant-scoped object_key mismatch", async () => {
      let rejected = false;
      try {
        await withTenantRls(tenantA, async (tx) => {
          await tx.ticketAttachment.create({
            data: {
              tenantId: tenantA,
              ticketId: ticketAId,
              uploadedByUserId: requesterA,
              objectKey: `tickets/${tenantB}/${ticketAId}/${randomUUID()}/leak.pdf`,
              originalFileName: "leak.pdf",
              contentType: "application/pdf",
              sizeBytes: 512,
            },
          });
        });
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true, "object_key must be tenant-scoped");
    });

    it("replays duplicate ticket creation idempotency key within tenant", async () => {
      const idem = `ticket-idem-${randomUUID()}`;
      const ticketId1 = randomUUID();
      const ticketId2 = randomUUID();

      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketId1,
            tenantId: tenantA,
            requesterUserId: requesterA,
            categoryCode: "general",
            priority: "low",
            status: "open",
            subject: "First create",
            lastActivityAt: new Date(),
            creationIdempotencyKey: idem,
          },
        });
      });

      let duplicateRejected = false;
      try {
        await withTenantRls(tenantA, async (tx) => {
          await tx.ticket.create({
            data: {
              id: ticketId2,
              tenantId: tenantA,
              requesterUserId: requesterA,
              categoryCode: "general",
              priority: "low",
              status: "open",
              subject: "Duplicate create",
              lastActivityAt: new Date(),
              creationIdempotencyKey: idem,
            },
          });
        });
      } catch {
        duplicateRejected = true;
      }
      assert.equal(duplicateRejected, true, "duplicate ticket idempotency key must be rejected");

      await withTenantRls(tenantB, async (tx) => {
        const otherTenantTicket = await tx.ticket.create({
          data: {
            tenantId: tenantB,
            requesterUserId: randomUUID(),
            categoryCode: "general",
            priority: "low",
            status: "open",
            subject: "Other tenant same idem key",
            lastActivityAt: new Date(),
            creationIdempotencyKey: idem,
          },
        });
        assert.ok(otherTenantTicket.id);
      });
    });

    it("replays duplicate message idempotency key per ticket and allows same key on other tenant", async () => {
      const idem = `msg-idem-${randomUUID()}`;
      const msgId1 = randomUUID();

      await withTenantRls(tenantA, async (tx) => {
        await tx.ticketMessage.create({
          data: {
            id: msgId1,
            tenantId: tenantA,
            ticketId: ticketAId,
            authorUserId: requesterA,
            visibility: "public",
            body: "First message",
            idempotencyKey: idem,
          },
        });
      });

      let duplicateRejected = false;
      try {
        await withTenantRls(tenantA, async (tx) => {
          await tx.ticketMessage.create({
            data: {
              tenantId: tenantA,
              ticketId: ticketAId,
              authorUserId: requesterA,
              visibility: "public",
              body: "Duplicate message",
              idempotencyKey: idem,
            },
          });
        });
      } catch {
        duplicateRejected = true;
      }
      assert.equal(duplicateRejected, true, "duplicate message idempotency key must be rejected");

      const ticketBId = randomUUID();
      await withTenantRls(tenantB, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketBId,
            tenantId: tenantB,
            requesterUserId: randomUUID(),
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "Tenant B ticket",
            lastActivityAt: new Date(),
          },
        });
        const otherTenantMessage = await tx.ticketMessage.create({
          data: {
            tenantId: tenantB,
            ticketId: ticketBId,
            authorUserId: randomUUID(),
            visibility: "public",
            body: "Same idem key different tenant",
            idempotencyKey: idem,
          },
        });
        assert.ok(otherTenantMessage.id);
      });
    });

    it("produces rowVersion conflict on stale optimistic update", async () => {
      await withTenantRls(tenantA, async (tx) => {
        const updated = await tx.ticket.updateMany({
          where: { id: ticketAId, tenantId: tenantA, rowVersion: 1 },
          data: { status: "pending_member", rowVersion: 2, lastActivityAt: new Date() },
        });
        assert.equal(updated.count, 1);

        const stale = await tx.ticket.updateMany({
          where: { id: ticketAId, tenantId: tenantA, rowVersion: 1 },
          data: { status: "resolved", rowVersion: 3, lastActivityAt: new Date() },
        });
        assert.equal(stale.count, 0, "stale rowVersion must not update");
      });
    });

    it("Tenant A can read own rows; Tenant B cannot read Tenant A rows", async () => {
      await withTenantRls(tenantA, async (tx) => {
        const ticket = await tx.ticket.findUnique({ where: { id: ticketAId } });
        assert.ok(ticket !== null);
        const messages = await tx.ticketMessage.findMany({ where: { ticketId: ticketAId } });
        assert.ok(messages.length >= 2);
      });

      await withTenantRls(tenantB, async (tx) => {
        assert.equal(await tx.ticket.findUnique({ where: { id: ticketAId } }), null);
        assert.equal(await tx.ticketMessage.findUnique({ where: { id: messageAId } }), null);
        assert.equal(await tx.ticketEvent.findUnique({ where: { id: eventAId } }), null);
        assert.equal(await tx.ticketAttachment.findUnique({ where: { id: attachmentAId } }), null);
        assert.equal(await tx.ticketLink.findUnique({ where: { id: linkAId } }), null);
      });
    });

    it("Tenant B cannot UPDATE or DELETE Tenant A rows", async () => {
      await withTenantRls(tenantB, async (tx) => {
        assert.equal(
          (
            await tx.ticket.updateMany({
              where: { id: ticketAId },
              data: { subject: "Hijacked" },
            })
          ).count,
          0,
        );
        assert.equal((await tx.ticketMessage.deleteMany({ where: { id: messageAId } })).count, 0);
        assert.equal((await tx.ticketEvent.deleteMany({ where: { id: eventAId } })).count, 0);
        assert.equal(
          (await tx.ticketAttachment.deleteMany({ where: { id: attachmentAId } })).count,
          0,
        );
        assert.equal((await tx.ticketLink.deleteMany({ where: { id: linkAId } })).count, 0);
        assert.equal((await tx.ticket.deleteMany({ where: { id: ticketAId } })).count, 0);
      });

      const admin = getPrismaAdmin();
      const ticket = await admin.ticket.findUnique({ where: { id: ticketAId } });
      assert.equal(ticket?.subject, "Payment question");
    });

    it("Tenant B WITH CHECK rejects cross-tenant INSERT on all ticketing tables", async () => {
      const cases = [
        async () =>
          withTenantRls(tenantB, async (tx) => {
            await tx.ticket.create({
              data: {
                tenantId: tenantA,
                requesterUserId: requesterA,
                categoryCode: "billing",
                priority: "normal",
                status: "open",
                subject: "Cross tenant ticket",
                lastActivityAt: new Date(),
              },
            });
          }),
        async () =>
          withTenantRls(tenantB, async (tx) => {
            await tx.ticketMessage.create({
              data: {
                tenantId: tenantA,
                ticketId: ticketAId,
                authorUserId: requesterA,
                visibility: "public",
                body: "Cross tenant message",
              },
            });
          }),
        async () =>
          withTenantRls(tenantB, async (tx) => {
            await tx.ticketEvent.create({
              data: {
                tenantId: tenantA,
                ticketId: ticketAId,
                eventType: "ticket.created",
                payload: {},
              },
            });
          }),
        async () =>
          withTenantRls(tenantB, async (tx) => {
            await tx.ticketAttachment.create({
              data: {
                tenantId: tenantA,
                ticketId: ticketAId,
                uploadedByUserId: requesterA,
                objectKey: ticketObjectKey(tenantA, ticketAId, "x.pdf"),
                originalFileName: "x.pdf",
                contentType: "application/pdf",
                sizeBytes: 100,
              },
            });
          }),
        async () =>
          withTenantRls(tenantB, async (tx) => {
            await tx.ticketLink.create({
              data: {
                tenantId: tenantA,
                ticketId: ticketAId,
                entityType: "wallet",
                entityId: randomUUID(),
              },
            });
          }),
      ] as const;

      for (const attempt of cases) {
        let rejected = false;
        try {
          await attempt();
        } catch {
          rejected = true;
        }
        assert.equal(rejected, true, "cross-tenant INSERT must be rejected by RLS WITH CHECK");
      }
    });

    it("rejects TicketMessage for foreign-tenant ticket via composite FK", async () => {
      let rejected = false;
      try {
        await withTenantRls(tenantB, async (tx) => {
          await tx.ticketMessage.create({
            data: {
              tenantId: tenantB,
              ticketId: ticketAId,
              authorUserId: randomUUID(),
              visibility: "public",
              body: "Message on foreign ticket",
            },
          });
        });
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true, "message must not attach to foreign-tenant ticket");
    });

    it("cascades child rows when ticket is hard-deleted", async () => {
      const cascadeTicketId = randomUUID();
      const cascadeMessageId = randomUUID();
      const cascadeEventId = randomUUID();
      const cascadeAttachmentId = randomUUID();
      const cascadeLinkId = randomUUID();

      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: cascadeTicketId,
            tenantId: tenantA,
            requesterUserId: requesterA,
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "Cascade proof",
            lastActivityAt: new Date(),
          },
        });
        await tx.ticketMessage.create({
          data: {
            id: cascadeMessageId,
            tenantId: tenantA,
            ticketId: cascadeTicketId,
            authorUserId: requesterA,
            visibility: "public",
            body: "Cascade message",
          },
        });
        await tx.ticketEvent.create({
          data: {
            id: cascadeEventId,
            tenantId: tenantA,
            ticketId: cascadeTicketId,
            eventType: "ticket.created",
            payload: {},
          },
        });
        await tx.ticketAttachment.create({
          data: {
            id: cascadeAttachmentId,
            tenantId: tenantA,
            ticketId: cascadeTicketId,
            uploadedByUserId: requesterA,
            objectKey: ticketObjectKey(tenantA, cascadeTicketId, "cascade.pdf"),
            originalFileName: "cascade.pdf",
            contentType: "application/pdf",
            sizeBytes: 256,
          },
        });
        await tx.ticketLink.create({
          data: {
            id: cascadeLinkId,
            tenantId: tenantA,
            ticketId: cascadeTicketId,
            entityType: "payment",
            entityId: randomUUID(),
          },
        });

        await tx.ticket.delete({ where: { id: cascadeTicketId } });
      });

      const admin = getPrismaAdmin();
      assert.equal(await admin.ticketMessage.count({ where: { id: cascadeMessageId } }), 0);
      assert.equal(await admin.ticketEvent.count({ where: { id: cascadeEventId } }), 0);
      assert.equal(await admin.ticketAttachment.count({ where: { id: cascadeAttachmentId } }), 0);
      assert.equal(await admin.ticketLink.count({ where: { id: cascadeLinkId } }), 0);
    });

    it("does not affect existing AuditEvent rows", async () => {
      const admin = getPrismaAdmin();
      const auditId = randomUUID();
      await admin.auditEvent.create({
        data: {
          id: auditId,
          tenantId: tenantA,
          action: "ticket.proof",
          entityType: "ticket",
          entityId: ticketAId,
          metadata: { proof: true },
        },
      });

      const row = await admin.auditEvent.findUnique({ where: { id: auditId } });
      assert.ok(row !== null);
      assert.equal(row?.entityType, "ticket");
      assert.equal(row?.action, "ticket.proof");
    });

    it("rejects message delete while attachment references it (RESTRICT)", async () => {
      const restrictTicketId = randomUUID();
      const restrictMessageId = randomUUID();

      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: restrictTicketId,
            tenantId: tenantA,
            requesterUserId: requesterA,
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "Restrict proof",
            lastActivityAt: new Date(),
          },
        });
        await tx.ticketMessage.create({
          data: {
            id: restrictMessageId,
            tenantId: tenantA,
            ticketId: restrictTicketId,
            authorUserId: requesterA,
            visibility: "public",
            body: "Message with attachment",
          },
        });
        await tx.ticketAttachment.create({
          data: {
            tenantId: tenantA,
            ticketId: restrictTicketId,
            messageId: restrictMessageId,
            uploadedByUserId: requesterA,
            objectKey: ticketObjectKey(tenantA, restrictTicketId, "restrict.pdf"),
            originalFileName: "restrict.pdf",
            contentType: "application/pdf",
            sizeBytes: 128,
          },
        });
      });

      let rejected = false;
      try {
        await withTenantRls(tenantA, async (tx) => {
          await tx.ticketMessage.delete({ where: { id: restrictMessageId } });
        });
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true, "message delete must be blocked while attachment references it");
    });
  },
);
