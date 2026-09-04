/**
 * Ticketing operational D1 → PostgreSQL certification (TKT-001 Phase D1).
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../src/app";
import { resetLazyTicketingServiceForTests } from "../src/boot/lazy-ticketing-service";
import { disconnectPrisma } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

const postgresSkip = !hasDatabase
  ? "TICKETING_OPERATIONAL_D1_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN"
  : process.env.STORAGE_DRIVER?.trim().toLowerCase() !== "prisma"
    ? "TICKETING_OPERATIONAL_D1_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

function resolveAdminUrl(): string {
  const adminUrl = process.env.DATABASE_URL_ADMIN?.trim();
  if (!adminUrl) {
    throw new Error("TICKETING_OPERATIONAL_D1_REQUIRES_DATABASE_URL_ADMIN");
  }
  return adminUrl;
}

function integrationTenantId(): string {
  return randomUUID();
}

function authHeaders(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly role?: "admin" | "owner" | "member" | "viewer";
}): Record<string, string> {
  return {
    "x-tenant-id": input.tenantId,
    "x-authenticated-tenant-id": input.tenantId,
    "x-user-id": input.userId,
    "x-actor-role": input.role ?? "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-ticketing-op-d1",
  };
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly tenantId: string;
    readonly userId: string;
    readonly role?: "admin" | "owner" | "member" | "viewer";
    readonly body?: unknown;
    readonly idempotencyKey?: string;
    readonly extraHeaders?: Record<string, string>;
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
            ...authHeaders({
              tenantId: input.tenantId,
              userId: input.userId,
              role: input.role,
            }),
            ...(input.extraHeaders ?? {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            server.close();
            const text = Buffer.concat(chunks).toString("utf8");
            let body: Record<string, unknown> = {};
            if (text.length > 0) {
              body = JSON.parse(text) as Record<string, unknown>;
            }
            resolve({ status: res.statusCode ?? 0, body });
          });
        },
      );
      req.on("error", (error) => {
        server.close();
        reject(error);
      });
      if (payload !== undefined) {
        req.write(payload);
      }
      req.end();
    });
  });
}

describe(
  "ticketing-operational-d1-postgres.spec.ts — TKT-001 Phase D1",
  { concurrency: false, skip: postgresSkip },
  () => {
    const tenantDenali = integrationTenantId();
    const tenantUrban = integrationTenantId();
    const tenantStarter = integrationTenantId();
    const tenantB = integrationTenantId();
    const memberDenali = randomUUID();
    const adminDenali = randomUUID();
    const viewerDenali = randomUUID();
    const outsiderUser = randomUUID();
    const assigneeDenali = randomUUID();
    let admin: PrismaClient;
    const listener = createRequestListener();

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.OUTBOX_RELAY_ENABLED = "false";
      resetLazyTicketingServiceForTests();

      admin = new PrismaClient({ datasources: { db: { url: resolveAdminUrl() } } });

      await admin.tenant.createMany({
        data: [
          {
            id: tenantDenali,
            subdomain: `tkt-d1-denali-${tenantDenali.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing"] },
          },
          {
            id: tenantUrban,
            subdomain: `tkt-d1-urban-${tenantUrban.slice(0, 8)}`,
            workspaceType: "urban",
            theme: {},
          },
          {
            id: tenantStarter,
            subdomain: `tkt-d1-starter-${tenantStarter.slice(0, 8)}`,
            workspaceType: "starter",
            theme: {},
          },
          {
            id: tenantB,
            subdomain: `tkt-d1-b-${tenantB.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing"] },
          },
        ],
      });

      await admin.user.createMany({
        data: [
          { id: memberDenali, mobile: `+98912${memberDenali.replace(/-/g, "").slice(0, 8)}` },
          { id: adminDenali, mobile: `+98912${adminDenali.replace(/-/g, "").slice(0, 8)}` },
          { id: viewerDenali, mobile: `+98912${viewerDenali.replace(/-/g, "").slice(0, 8)}` },
          { id: outsiderUser, mobile: `+98912${outsiderUser.replace(/-/g, "").slice(0, 8)}` },
          { id: assigneeDenali, mobile: `+98912${assigneeDenali.replace(/-/g, "").slice(0, 8)}` },
        ],
      });

      await admin.userTenant.createMany({
        data: [
          { tenantId: tenantDenali, userId: memberDenali, role: "member", status: "ACTIVE" },
          { tenantId: tenantDenali, userId: adminDenali, role: "admin", status: "ACTIVE" },
          { tenantId: tenantDenali, userId: viewerDenali, role: "viewer", status: "ACTIVE" },
          { tenantId: tenantDenali, userId: assigneeDenali, role: "admin", status: "ACTIVE" },
          { tenantId: tenantB, userId: adminDenali, role: "admin", status: "ACTIVE" },
        ],
      });
    });

    async function cleanupTenant(tenantId: string): Promise<void> {
      await admin.ticketTagAssignment.deleteMany({ where: { tenantId } });
      await admin.ticketTeamMember.deleteMany({ where: { tenantId } });
      await admin.ticketLink.deleteMany({ where: { tenantId } });
      await admin.ticketMessage.deleteMany({ where: { tenantId } });
      await admin.ticketEvent.deleteMany({ where: { tenantId } });
      await admin.ticket.deleteMany({ where: { tenantId } });
      await admin.ticketTag.deleteMany({ where: { tenantId } });
      await admin.ticketQueue.deleteMany({ where: { tenantId } });
      await admin.ticketTeam.deleteMany({ where: { tenantId } });
      await admin.httpIdempotencyRecord.deleteMany({ where: { tenantId } });
      await admin.outboxEvent.deleteMany({ where: { tenantId } });
    }

    beforeEach(async () => {
      resetLazyTicketingServiceForTests();
      for (const tenantId of [tenantDenali, tenantB]) {
        await cleanupTenant(tenantId);
      }
    });

    after(async () => {
      try {
        for (const tenantId of [tenantDenali, tenantUrban, tenantStarter, tenantB]) {
          await cleanupTenant(tenantId);
        }
        await admin.$executeRawUnsafe(
          "ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only",
        );
        try {
          await admin.auditEvent.deleteMany({
            where: {
              tenantId: { in: [tenantDenali, tenantUrban, tenantStarter, tenantB] },
            },
          });
        } finally {
          await admin.$executeRawUnsafe(
            "ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only",
          );
        }
        await admin.userTenant.deleteMany({
          where: { tenantId: { in: [tenantDenali, tenantB] } },
        });
        await admin.user.deleteMany({
          where: { id: { in: [memberDenali, adminDenali, viewerDenali, outsiderUser, assigneeDenali] } },
        });
        await admin.tenant.deleteMany({
          where: { id: { in: [tenantDenali, tenantUrban, tenantStarter, tenantB] } },
        });
      } finally {
        await admin.$disconnect();
        await disconnectPrisma();
      }
    });

    async function createTicket(input?: {
      readonly tenantId?: string;
      readonly userId?: string;
      readonly categoryCode?: string;
    }): Promise<{ ticketId: string; rowVersion: number }> {
      const response = await requestJson(listener, {
        method: "POST",
        path: "/member/tickets",
        tenantId: input?.tenantId ?? tenantDenali,
        userId: input?.userId ?? memberDenali,
        idempotencyKey: `create-${randomUUID()}`,
        body: {
          categoryCode: input?.categoryCode ?? "general",
          subject: "Operational D1 ticket",
          body: "Test body for operational layer.",
        },
      });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      const envelope = response.body.ticket as Record<string, unknown>;
      return {
        ticketId: (envelope.ticket as Record<string, unknown>).id as string,
        rowVersion: envelope.rowVersion as number,
      };
    }

    it("lists manifest categories for denali tenant", async () => {
      const response = await requestJson(listener, {
        method: "GET",
        path: "/ticket-categories",
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
      });
      assert.equal(response.status, 200);
      const items = response.body.items as Array<Record<string, unknown>>;
      const codes = items.map((item) => item.code);
      assert.ok(codes.includes("general"));
      assert.ok(codes.includes("billing"));
      assert.ok(codes.includes("tour"));
      assert.ok(codes.includes("technical"));
    });

    it("disabled workspace urban returns TICKET_MODULE_DISABLED", async () => {
      const response = await requestJson(listener, {
        method: "GET",
        path: "/ticket-categories",
        tenantId: tenantUrban,
        userId: adminDenali,
        role: "admin",
      });
      assert.equal(response.status, 404);
      assert.equal(response.body.code, "TICKET_MODULE_DISABLED");
    });

    it("disabled workspace starter returns TICKET_MODULE_DISABLED", async () => {
      const response = await requestJson(listener, {
        method: "GET",
        path: "/ticket-tags",
        tenantId: tenantStarter,
        userId: adminDenali,
        role: "admin",
      });
      assert.equal(response.status, 404);
      assert.equal(response.body.code, "TICKET_MODULE_DISABLED");
    });

    it("rejects invalid category on member create", async () => {
      const response = await requestJson(listener, {
        method: "POST",
        path: "/member/tickets",
        tenantId: tenantDenali,
        userId: memberDenali,
        idempotencyKey: `invalid-cat-${randomUUID()}`,
        body: {
          categoryCode: "not-a-real-category",
          subject: "Bad category",
          body: "Should fail validation.",
        },
      });
      assert.equal(response.status, 422);
      assert.equal(response.body.code, "TICKET_CATEGORY_INVALID");
    });

    it("rejects duplicate tag code", async () => {
      const first = await requestJson(listener, {
        method: "POST",
        path: "/ticket-tags",
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `tag-${randomUUID()}`,
        body: { code: "urgent-review", label: "Urgent review" },
      });
      assert.equal(first.status, 201);

      const second = await requestJson(listener, {
        method: "POST",
        path: "/ticket-tags",
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `tag-dup-${randomUUID()}`,
        body: { code: "urgent-review", label: "Duplicate" },
      });
      assert.equal(second.status, 409);
      assert.equal(second.body.code, "TICKET_DUPLICATE_TAG");
    });

    it("isolates queue and team config across tenants", async () => {
      const queueCreate = await requestJson(listener, {
        method: "POST",
        path: "/ticket-queues",
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `queue-${randomUUID()}`,
        body: { code: "billing-queue", name: "Billing queue" },
      });
      assert.equal(queueCreate.status, 201);

      const teamCreate = await requestJson(listener, {
        method: "POST",
        path: "/ticket-teams",
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `team-${randomUUID()}`,
        body: { code: "billing-team", name: "Billing team" },
      });
      assert.equal(teamCreate.status, 201);

      const crossList = await requestJson(listener, {
        method: "GET",
        path: "/ticket-queues",
        tenantId: tenantB,
        userId: adminDenali,
        role: "admin",
      });
      assert.equal(crossList.status, 200);
      const items = crossList.body.items as Array<Record<string, unknown>>;
      assert.equal(items.length, 0);
    });

    it("rejects assignment outside tenant", async () => {
      const { ticketId, rowVersion } = await createTicket();
      const response = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/assign`,
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `assign-out-${randomUUID()}`,
        body: { assigneeUserId: outsiderUser, rowVersion },
      });
      assert.equal(response.status, 422);
      assert.equal(response.body.code, "TICKET_ASSIGNEE_INVALID");
    });

    it("denies viewer and member config mutations", async () => {
      const viewerTag = await requestJson(listener, {
        method: "POST",
        path: "/ticket-tags",
        tenantId: tenantDenali,
        userId: viewerDenali,
        role: "viewer",
        idempotencyKey: `viewer-tag-${randomUUID()}`,
        body: { code: "viewer-tag", label: "Viewer tag" },
      });
      assert.equal(viewerTag.status, 404);

      const memberTag = await requestJson(listener, {
        method: "POST",
        path: "/ticket-tags",
        tenantId: tenantDenali,
        userId: memberDenali,
        role: "member",
        idempotencyKey: `member-tag-${randomUUID()}`,
        body: { code: "member-tag", label: "Member tag" },
      });
      assert.equal(memberTag.status, 404);
    });

    it("allows admin tenant-scoped queue and team mutations", async () => {
      const team = await requestJson(listener, {
        method: "POST",
        path: "/ticket-teams",
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `team-admin-${randomUUID()}`,
        body: {
          code: "ops-team",
          name: "Ops team",
          memberUserIds: [assigneeDenali],
        },
      });
      assert.equal(team.status, 201);

      const queue = await requestJson(listener, {
        method: "POST",
        path: "/ticket-queues",
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `queue-admin-${randomUUID()}`,
        body: {
          code: "ops-queue",
          name: "Ops queue",
          teamCode: "ops-team",
        },
      });
      assert.equal(queue.status, 201);
      assert.equal(queue.body.teamCode, "ops-team");
    });

    it("denies cross-tenant RLS reads on operational tables", async () => {
      await admin.ticketTag.create({
        data: {
          id: randomUUID(),
          tenantId: tenantDenali,
          code: "rls-tag",
          label: "RLS tag",
        },
      });

      const rows = await withTenantRls(tenantB, async (tx) => {
        return tx.ticketTag.findMany({ where: { code: "rls-tag" } });
      });
      assert.equal(rows.length, 0);
    });

    it("supports idempotency and rowVersion conflict on assign", async () => {
      const { ticketId, rowVersion } = await createTicket();
      const idempotencyKey = `assign-idem-${randomUUID()}`;
      const body = { assigneeUserId: assigneeDenali, rowVersion };
      const first = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/assign`,
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey,
        body,
      });
      assert.equal(first.status, 200, JSON.stringify(first.body));
      const second = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/assign`,
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey,
        body,
      });
      assert.equal(second.status, 200);
      assert.equal(
        (first.body.ticket as Record<string, unknown>).rowVersion,
        (second.body.ticket as Record<string, unknown>).rowVersion,
      );

      const stale = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/assign`,
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `assign-stale-${randomUUID()}`,
        body: { assigneeUserId: assigneeDenali, rowVersion },
      });
      assert.equal(stale.status, 409);
      assert.equal(stale.body.code, "TICKET_VERSION_CONFLICT");
    });

    it("writes events and audit on queue change and tag mutation", async () => {
      const tagCreate = await requestJson(listener, {
        method: "POST",
        path: "/ticket-tags",
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `audit-tag-${randomUUID()}`,
        body: { code: "needs-review", label: "Needs review" },
      });
      assert.equal(tagCreate.status, 201);

      const queueCreate = await requestJson(listener, {
        method: "POST",
        path: "/ticket-queues",
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `audit-queue-${randomUUID()}`,
        body: { code: "review-queue", name: "Review queue" },
      });
      assert.equal(queueCreate.status, 201);

      const { ticketId, rowVersion } = await createTicket();

      const queueChange = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/queue`,
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `queue-change-${randomUUID()}`,
        body: { queueCode: "review-queue", rowVersion },
      });
      assert.equal(queueChange.status, 200);

      const tagAdd = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/tags`,
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `tag-add-${randomUUID()}`,
        body: { tagCode: "needs-review", rowVersion: rowVersion + 1 },
      });
      assert.equal(tagAdd.status, 200);

      const events = await admin.ticketEvent.findMany({
        where: { tenantId: tenantDenali, ticketId },
        orderBy: { createdAt: "asc" },
      });
      const eventTypes = events.map((event) => event.eventType);
      assert.ok(eventTypes.includes("ticket.created"));
      assert.ok(eventTypes.includes("ticket.queue.changed"));
      assert.ok(eventTypes.includes("ticket.tag.added"));

      const auditRows = await admin.auditEvent.findMany({
        where: { tenantId: tenantDenali, entityId: ticketId },
      });
      assert.ok(auditRows.length >= 3);
    });

    it("filters operator list by tag and queue", async () => {
      await requestJson(listener, {
        method: "POST",
        path: "/ticket-tags",
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `filter-tag-${randomUUID()}`,
        body: { code: "filter-tag", label: "Filter tag" },
      });
      await requestJson(listener, {
        method: "POST",
        path: "/ticket-queues",
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `filter-queue-${randomUUID()}`,
        body: { code: "filter-queue", name: "Filter queue" },
      });

      const ticketA = await createTicket();
      const ticketB = await createTicket();

      await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketA.ticketId}/queue`,
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `fq-${randomUUID()}`,
        body: { queueCode: "filter-queue", rowVersion: ticketA.rowVersion },
      });
      await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketB.ticketId}/tags`,
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `ft-${randomUUID()}`,
        body: { tagCode: "filter-tag", rowVersion: ticketB.rowVersion },
      });

      const byQueue = await requestJson(listener, {
        method: "GET",
        path: "/tickets?queueCode=filter-queue",
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
      });
      assert.equal(byQueue.status, 200);
      const queueItems = byQueue.body.items as Array<Record<string, unknown>>;
      assert.equal(queueItems.length, 1);
      assert.equal(queueItems[0]?.id, ticketA.ticketId);

      const byTag = await requestJson(listener, {
        method: "GET",
        path: "/tickets?tagCode=filter-tag",
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
      });
      assert.equal(byTag.status, 200);
      const tagItems = byTag.body.items as Array<Record<string, unknown>>;
      assert.equal(tagItems.length, 1);
      assert.equal(tagItems[0]?.id, ticketB.ticketId);
    });
  },
);
