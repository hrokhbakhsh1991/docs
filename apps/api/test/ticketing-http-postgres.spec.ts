/**
 * Ticketing HTTP → PostgreSQL certification matrix (TKT-001 Phase C1).
 *
 * Path: HTTP → ticketing-http routes → TicketingService → PrismaTicketingRepository → PostgreSQL + RLS
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../src/app";
import { resetLazyTicketingServiceForTests } from "../src/boot/lazy-ticketing-service";
import { disconnectPrisma, getPrisma } from "../src/db/prisma";
import { assertPostgresAppRoleForRlsTests } from "../src/workspace-ticketing/ticketing-postgres-test-helpers";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

const postgresSkip = !hasDatabase
  ? "TICKETING_HTTP_POSTGRES_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN"
  : process.env.STORAGE_DRIVER?.trim().toLowerCase() !== "prisma"
    ? "TICKETING_HTTP_POSTGRES_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

function resolveAdminUrl(): string {
  const adminUrl = process.env.DATABASE_URL_ADMIN?.trim();
  if (!adminUrl) {
    throw new Error("TICKETING_HTTP_POSTGRES_REQUIRES_DATABASE_URL_ADMIN");
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
    "x-workspace-id": "ws-ticketing-http-pg",
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
  "ticketing-http-postgres.spec.ts — TKT-001 Phase C1 HTTP certification",
  { concurrency: false, skip: postgresSkip },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const memberA = randomUUID();
    const memberB = randomUUID();
    const adminA = randomUUID();
    const viewerA = randomUUID();
    const assigneeA = randomUUID();
    const tourA = randomUUID();
    let admin: PrismaClient;
    const listener = createRequestListener();

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.OUTBOX_RELAY_ENABLED = "false";
      await assertPostgresAppRoleForRlsTests(getPrisma());
      resetLazyTicketingServiceForTests();

      admin = new PrismaClient({ datasources: { db: { url: resolveAdminUrl() } } });
      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `tkt-http-a-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing"] },
          },
          {
            id: tenantB,
            subdomain: `tkt-http-b-${tenantB.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing"] },
          },
        ],
      });

      await admin.user.createMany({
        data: [
          { id: memberA, mobile: `+98912${memberA.replace(/-/g, "").slice(0, 8)}` },
          { id: memberB, mobile: `+98912${memberB.replace(/-/g, "").slice(0, 8)}` },
          { id: adminA, mobile: `+98912${adminA.replace(/-/g, "").slice(0, 8)}` },
          { id: viewerA, mobile: `+98912${viewerA.replace(/-/g, "").slice(0, 8)}` },
          { id: assigneeA, mobile: `+98912${assigneeA.replace(/-/g, "").slice(0, 8)}` },
        ],
      });

      await admin.userTenant.createMany({
        data: [
          { tenantId: tenantA, userId: memberA, role: "member", status: "ACTIVE" },
          { tenantId: tenantA, userId: memberB, role: "member", status: "ACTIVE" },
          { tenantId: tenantA, userId: adminA, role: "admin", status: "ACTIVE" },
          { tenantId: tenantA, userId: viewerA, role: "viewer", status: "ACTIVE" },
          { tenantId: tenantA, userId: assigneeA, role: "admin", status: "ACTIVE" },
        ],
      });

      await admin.tour.create({
        data: {
          id: tourA,
          tenantId: tenantA,
          title: "Ticketing HTTP Cert Tour",
          publishStatus: "published",
          canonical: { schemaVersion: 1, roots: [], data: { title: "Ticketing HTTP Cert Tour" } },
        },
      });
    });

    beforeEach(async () => {
      resetLazyTicketingServiceForTests();
      for (const tenantId of [tenantA, tenantB]) {
        await admin.ticketLink.deleteMany({ where: { tenantId } });
        await admin.ticketMessage.deleteMany({ where: { tenantId } });
        await admin.ticketEvent.deleteMany({ where: { tenantId } });
        await admin.ticket.deleteMany({ where: { tenantId } });
        await admin.httpIdempotencyRecord.deleteMany({ where: { tenantId } });
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
      }
    });

    after(async () => {
      try {
        for (const tenantId of [tenantA, tenantB]) {
          await admin.ticketLink.deleteMany({ where: { tenantId } });
          await admin.ticketMessage.deleteMany({ where: { tenantId } });
          await admin.ticketEvent.deleteMany({ where: { tenantId } });
          await admin.ticket.deleteMany({ where: { tenantId } });
          await admin.httpIdempotencyRecord.deleteMany({ where: { tenantId } });
          await admin.outboxEvent.deleteMany({ where: { tenantId } });
        }
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
        await admin.userTenant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.user.deleteMany({
          where: { id: { in: [memberA, memberB, adminA, viewerA, assigneeA] } },
        });
        await admin.tour.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.tour.deleteMany({ where: { id: tourA } });
        await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      } finally {
        await admin.$disconnect();
        await disconnectPrisma();
      }
    });

    async function createTicket(input?: {
      readonly tenantId?: string;
      readonly userId?: string;
      readonly idempotencyKey?: string;
      readonly subject?: string;
    }): Promise<{ ticketId: string; rowVersion: number }> {
      const idempotencyKey = input?.idempotencyKey ?? `create-${randomUUID()}`;
      const response = await requestJson(listener, {
        method: "POST",
        path: "/member/tickets",
        tenantId: input?.tenantId ?? tenantA,
        userId: input?.userId ?? memberA,
        idempotencyKey,
        body: {
          categoryCode: "billing",
          subject: input?.subject ?? "Need help with billing",
          body: "Please review my invoice.",
        },
      });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      const envelope = response.body.ticket as Record<string, unknown>;
      const summary = envelope.ticket as Record<string, unknown>;
      assert.equal(typeof summary.id, "string");
      return {
        ticketId: summary.id as string,
        rowVersion: envelope.rowVersion as number,
      };
    }

    // ─── Member API ─────────────────────────────────────────────────────

    it("member creates ticket", async () => {
      const { ticketId } = await createTicket({ subject: "Member create" });
      const row = await admin.ticket.findUnique({ where: { id: ticketId } });
      assert.ok(row !== null);
      assert.equal(row?.tenantId, tenantA);
      assert.equal(row?.requesterUserId, memberA);
      assert.equal(row?.status, "open");
    });

    it("member lists own tickets", async () => {
      await createTicket({ userId: memberA, subject: "Own ticket A" });
      await createTicket({ userId: memberB, subject: "Other member ticket" });
      const response = await requestJson(listener, {
        method: "GET",
        path: "/member/tickets",
        tenantId: tenantA,
        userId: memberA,
        role: "member",
      });
      assert.equal(response.status, 200);
      const items = response.body.items as Array<Record<string, unknown>>;
      assert.equal(items.length, 1);
      assert.equal(items[0]?.subject, "Own ticket A");
    });

    it("member reads own ticket", async () => {
      const { ticketId } = await createTicket();
      const response = await requestJson(listener, {
        method: "GET",
        path: `/member/tickets/${ticketId}`,
        tenantId: tenantA,
        userId: memberA,
      });
      assert.equal(response.status, 200);
      assert.equal((response.body.ticket as Record<string, unknown>).id, ticketId);
    });

    it("member cannot read another member ticket", async () => {
      const { ticketId } = await createTicket({ userId: memberA });
      const response = await requestJson(listener, {
        method: "GET",
        path: `/member/tickets/${ticketId}`,
        tenantId: tenantA,
        userId: memberB,
      });
      assert.equal(response.status, 404);
    });

    it("member adds public message", async () => {
      const { ticketId } = await createTicket();
      const response = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/messages`,
        tenantId: tenantA,
        userId: memberA,
        idempotencyKey: `msg-${randomUUID()}`,
        body: { body: "Follow-up from member" },
      });
      assert.equal(response.status, 201);
      assert.equal(
        (response.body.message as Record<string, unknown>).body,
        "Follow-up from member",
      );
    });

    it("member cannot add internal note via operator endpoint", async () => {
      const { ticketId } = await createTicket();
      const response = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/internal-notes`,
        tenantId: tenantA,
        userId: memberA,
        role: "member",
        idempotencyKey: `note-${randomUUID()}`,
        body: { body: "sneaky internal" },
      });
      assert.equal(response.status, 403);
    });

    it("member reopens resolved ticket", async () => {
      const { ticketId, rowVersion } = await createTicket();
      const resolveResponse = await requestJson(listener, {
        method: "PATCH",
        path: `/tickets/${ticketId}`,
        tenantId: tenantA,
        userId: adminA,
        role: "admin",
        idempotencyKey: `resolve-${randomUUID()}`,
        body: { status: "resolved", rowVersion },
      });
      assert.equal(resolveResponse.status, 200);

      const reopenResponse = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/reopen`,
        tenantId: tenantA,
        userId: memberA,
        idempotencyKey: `reopen-${randomUUID()}`,
        body: {},
      });
      assert.equal(reopenResponse.status, 200);
      const reopened = reopenResponse.body.ticket as Record<string, unknown>;
      assert.equal(reopened.status, "open");
    });

    it("member cannot reopen closed ticket", async () => {
      const { ticketId, rowVersion } = await createTicket();
      let version = rowVersion;
      for (const status of ["resolved", "closed"] as const) {
        const patch = await requestJson(listener, {
          method: "PATCH",
          path: `/tickets/${ticketId}`,
          tenantId: tenantA,
          userId: adminA,
          role: "admin",
          idempotencyKey: `status-${status}-${randomUUID()}`,
          body: { status, rowVersion: version },
        });
        assert.equal(patch.status, 200, JSON.stringify(patch.body));
        version = ((patch.body.ticket as Record<string, unknown>).rowVersion as number) ?? version + 1;
      }
      const reopenResponse = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/reopen`,
        tenantId: tenantA,
        userId: memberA,
        idempotencyKey: `reopen-closed-${randomUUID()}`,
        body: {},
      });
      assert.equal(reopenResponse.status, 409);
    });

    it("internal messages never appear in member response", async () => {
      const { ticketId, rowVersion } = await createTicket();
      const noteResponse = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/internal-notes`,
        tenantId: tenantA,
        userId: adminA,
        role: "admin",
        idempotencyKey: `internal-${randomUUID()}`,
        body: { body: "operator secret" },
      });
      assert.equal(noteResponse.status, 201);

      const getResponse = await requestJson(listener, {
        method: "GET",
        path: `/member/tickets/${ticketId}`,
        tenantId: tenantA,
        userId: memberA,
      });
      assert.equal(getResponse.status, 200);
      const messages = getResponse.body.messages as Array<Record<string, unknown>>;
      assert.ok(messages.every((message) => message.visibility === undefined));
      assert.ok(messages.every((message) => message.body !== "operator secret"));
    });

    it("viewer reads internal notes on member ticket detail route", async () => {
      const { ticketId } = await createTicket();
      const noteResponse = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/internal-notes`,
        tenantId: tenantA,
        userId: adminA,
        role: "admin",
        idempotencyKey: `viewer-internal-${randomUUID()}`,
        body: { body: "viewer-visible internal" },
      });
      assert.equal(noteResponse.status, 201);

      const viewerResponse = await requestJson(listener, {
        method: "GET",
        path: `/member/tickets/${ticketId}`,
        tenantId: tenantA,
        userId: viewerA,
        role: "viewer",
      });
      assert.equal(viewerResponse.status, 200);
      const messages = viewerResponse.body.messages as Array<Record<string, unknown>>;
      const internal = messages.find((message) => message.visibility === "internal");
      assert.ok(internal);
      assert.equal(internal?.body, "viewer-visible internal");
    });

    // ─── Operator API ───────────────────────────────────────────────────

    it("operator lists tenant tickets", async () => {
      await createTicket({ subject: "Tenant ticket 1" });
      await createTicket({ userId: memberB, subject: "Tenant ticket 2" });
      const response = await requestJson(listener, {
        method: "GET",
        path: "/tickets",
        tenantId: tenantA,
        userId: adminA,
        role: "admin",
      });
      assert.equal(response.status, 200);
      const items = response.body.items as Array<Record<string, unknown>>;
      assert.ok(items.length >= 2);
    });

    it("viewer reads tenant-wide but cannot mutate", async () => {
      const { ticketId } = await createTicket();
      const readResponse = await requestJson(listener, {
        method: "GET",
        path: `/tickets/${ticketId}`,
        tenantId: tenantA,
        userId: viewerA,
        role: "viewer",
      });
      assert.equal(readResponse.status, 200);

      const replyResponse = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/replies`,
        tenantId: tenantA,
        userId: viewerA,
        role: "viewer",
        idempotencyKey: `viewer-reply-${randomUUID()}`,
        body: { body: "viewer reply" },
      });
      assert.equal(replyResponse.status, 403);
    });

    it("operator public reply and internal note", async () => {
      const { ticketId } = await createTicket();
      const replyResponse = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/replies`,
        tenantId: tenantA,
        userId: adminA,
        role: "admin",
        idempotencyKey: `reply-${randomUUID()}`,
        body: { body: "public operator reply" },
      });
      assert.equal(replyResponse.status, 201);

      const noteResponse = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/internal-notes`,
        tenantId: tenantA,
        userId: adminA,
        role: "admin",
        idempotencyKey: `note-${randomUUID()}`,
        body: { body: "internal context" },
      });
      assert.equal(noteResponse.status, 201);
      assert.equal(
        (noteResponse.body.message as Record<string, unknown>).visibility,
        "internal",
      );
    });

    it("operator updates status, priority, and assignment", async () => {
      const { ticketId, rowVersion } = await createTicket();
      const patchResponse = await requestJson(listener, {
        method: "PATCH",
        path: `/tickets/${ticketId}`,
        tenantId: tenantA,
        userId: adminA,
        role: "admin",
        idempotencyKey: `patch-${randomUUID()}`,
        body: {
          status: "pending_member",
          priority: "high",
          assigneeUserId: assigneeA,
          rowVersion,
        },
      });
      assert.equal(patchResponse.status, 200, JSON.stringify(patchResponse.body));
      const ticket = patchResponse.body.ticket as Record<string, unknown>;
      const summary = ticket.ticket as Record<string, unknown>;
      assert.equal(summary.status, "pending_member");
      assert.equal(summary.priority, "high");
      assert.equal(summary.assigneeUserId, assigneeA);
      assert.equal(ticket.rowVersion, rowVersion + 3);
    });

    it("operator reopens closed ticket", async () => {
      const { ticketId, rowVersion } = await createTicket();
      let version = rowVersion;
      for (const status of ["resolved", "closed"] as const) {
        const patch = await requestJson(listener, {
          method: "PATCH",
          path: `/tickets/${ticketId}`,
          tenantId: tenantA,
          userId: adminA,
          role: "admin",
          idempotencyKey: `close-${status}-${randomUUID()}`,
          body: { status, rowVersion: version },
        });
        assert.equal(patch.status, 200);
        version = (patch.body.ticket as Record<string, unknown>).rowVersion as number;
      }
      const reopenResponse = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/reopen`,
        tenantId: tenantA,
        userId: adminA,
        role: "admin",
        idempotencyKey: `op-reopen-${randomUUID()}`,
        body: {},
      });
      assert.equal(reopenResponse.status, 200);
    });

    it("member cannot access operator list endpoint", async () => {
      const response = await requestJson(listener, {
        method: "GET",
        path: "/tickets",
        tenantId: tenantA,
        userId: memberA,
        role: "member",
      });
      assert.equal(response.status, 403);
    });

    // ─── Tenant isolation ─────────────────────────────────────────────────

    it("tenant A cannot read tenant B ticket", async () => {
      const { ticketId } = await createTicket({ tenantId: tenantA, userId: memberA });
      const adminB = randomUUID();
      await admin.tenant.upsert({
        where: { id: tenantB },
        create: {
          id: tenantB,
          subdomain: `tkt-http-b-${tenantB.slice(0, 8)}`,
          workspaceType: "denali",
          theme: { enabledModules: ["ticketing"] },
        },
        update: {},
      });
      const response = await requestJson(listener, {
        method: "GET",
        path: `/tickets/${ticketId}`,
        tenantId: tenantB,
        userId: adminB,
        role: "admin",
      });
      assert.equal(response.status, 404);
    });

    it("cross-tenant related tour link rejected on create", async () => {
      const tourB = randomUUID();
      await admin.tour.create({
        data: {
          id: tourB,
          tenantId: tenantB,
          title: "Tenant B tour",
          publishStatus: "published",
          canonical: { schemaVersion: 1, roots: [], data: { title: "Tenant B tour" } },
        },
      });
      const response = await requestJson(listener, {
        method: "POST",
        path: "/member/tickets",
        tenantId: tenantA,
        userId: memberA,
        idempotencyKey: `cross-tour-${randomUUID()}`,
        body: {
          categoryCode: "billing",
          subject: "Cross tenant tour",
          body: "Should fail",
          relatedTourId: tourB,
        },
      });
      assert.equal(response.status, 404);
      await admin.tour.delete({ where: { id: tourB } });
    });

    // ─── Idempotency ──────────────────────────────────────────────────────

    it("duplicate create does not create second ticket", async () => {
      const idempotencyKey = `dup-create-${randomUUID()}`;
      const body = {
        categoryCode: "billing",
        subject: "Duplicate attempt",
        body: "Same key",
      };
      const first = await requestJson(listener, {
        method: "POST",
        path: "/member/tickets",
        tenantId: tenantA,
        userId: memberA,
        idempotencyKey,
        body,
      });
      assert.equal(first.status, 201, JSON.stringify(first.body));
      const firstTicket = first.body.ticket as Record<string, unknown>;
      const firstSummary = firstTicket.ticket as Record<string, unknown>;
      const second = await requestJson(listener, {
        method: "POST",
        path: "/member/tickets",
        tenantId: tenantA,
        userId: memberA,
        idempotencyKey,
        body,
      });
      assert.equal(second.status, 201);
      const secondTicket = second.body.ticket as Record<string, unknown>;
      const secondSummary = secondTicket.ticket as Record<string, unknown>;
      assert.equal(secondSummary.id, firstSummary.id);
      const count = await admin.ticket.count({ where: { tenantId: tenantA } });
      assert.equal(count, 1);
    });

    it("duplicate message does not create second message", async () => {
      const { ticketId } = await createTicket();
      const idempotencyKey = `dup-msg-${randomUUID()}`;
      const first = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/messages`,
        tenantId: tenantA,
        userId: memberA,
        idempotencyKey,
        body: { body: "Once" },
      });
      assert.equal(first.status, 201);
      const second = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/messages`,
        tenantId: tenantA,
        userId: memberA,
        idempotencyKey,
        body: { body: "Once" },
      });
      assert.equal(second.status, 201);
      assert.equal(
        (first.body.message as Record<string, unknown>).id,
        (second.body.message as Record<string, unknown>).id,
      );
      const count = await admin.ticketMessage.count({ where: { tenantId: tenantA, ticketId } });
      assert.equal(count, 2);
    });

    // ─── Bulk operator actions ───────────────────────────────────────────

    it("bulk status update applies to multiple tickets with partial failure", async () => {
      const first = await createTicket({ subject: "Bulk one" });
      const second = await createTicket({ subject: "Bulk two" });
      const missingId = randomUUID();
      const response = await requestJson(listener, {
        method: "POST",
        path: "/tickets/bulk",
        tenantId: tenantA,
        userId: adminA,
        role: "admin",
        idempotencyKey: `bulk-${randomUUID()}`,
        body: {
          ticketIds: [first.ticketId, second.ticketId, missingId],
          status: "resolved",
        },
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const results = response.body.results as Array<Record<string, unknown>>;
      assert.equal(response.body.succeeded, 2);
      assert.equal(response.body.failed, 1);
      assert.equal(results.length, 3);
      assert.equal(results.filter((entry) => entry.ok === true).length, 2);
      assert.equal(results.find((entry) => entry.ticketId === missingId)?.ok, false);

      const firstRow = await admin.ticket.findUnique({
        where: { tenantId_id: { tenantId: tenantA, id: first.ticketId } },
      });
      assert.equal(firstRow?.status, "resolved");
    });

    // ─── Concurrency ──────────────────────────────────────────────────────

    it("stale rowVersion returns 409", async () => {
      const { ticketId, rowVersion } = await createTicket();
      const response = await requestJson(listener, {
        method: "PATCH",
        path: `/tickets/${ticketId}`,
        tenantId: tenantA,
        userId: adminA,
        role: "admin",
        idempotencyKey: `stale-${randomUUID()}`,
        body: { status: "pending_member", rowVersion: rowVersion + 99 },
      });
      assert.equal(response.status, 409);
      assert.equal(response.body.code, "TICKET_VERSION_CONFLICT");
    });

    // ─── Authorization ──────────────────────────────────────────────────

    it("missing auth headers returns 401", async () => {
      const response = await new Promise<{ status: number; body: Record<string, unknown> }>(
        (resolve, reject) => {
          const server = http.createServer(listener);
          server.listen(0, () => {
            const addr = server.address();
            if (!addr || typeof addr === "string") {
              server.close();
              reject(new Error("no listen address"));
              return;
            }
            const req = http.request(
              {
                hostname: "127.0.0.1",
                port: addr.port,
                path: "/member/tickets",
                method: "GET",
              },
              (res) => {
                const chunks: Buffer[] = [];
                res.on("data", (chunk) => chunks.push(chunk as Buffer));
                res.on("end", () => {
                  server.close();
                  resolve({ status: res.statusCode ?? 0, body: {} });
                });
              },
            );
            req.on("error", reject);
            req.end();
          });
        },
      );
      assert.equal(response.status, 401);
    });
  },
);
