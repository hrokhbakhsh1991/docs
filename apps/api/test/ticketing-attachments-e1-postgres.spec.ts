/**
 * Ticketing attachments + links E1 → PostgreSQL certification (TKT-001 Phase E1).
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../src/app";
import { resetLazyTicketingServiceForTests } from "../src/boot/lazy-ticketing-service";
import { disconnectPrisma } from "../src/db/prisma";
import { assertTenantOwnsObjectKey } from "../src/storage/assert-tenant-object-key-scope";
import { setTenantObjectStorageForTests } from "../src/storage/create-tenant-object-storage";
import type { TenantObjectStoragePort } from "../src/storage/tenant-object-storage.port";
import { withTenantRls } from "../src/db/with-tenant-rls";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

const postgresSkip = !hasDatabase
  ? "TICKETING_ATTACHMENTS_E1_REQUIRES_DATABASE"
  : process.env.STORAGE_DRIVER?.trim().toLowerCase() !== "prisma"
    ? "TICKETING_ATTACHMENTS_E1_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

function resolveAdminUrl(): string {
  const adminUrl = process.env.DATABASE_URL_ADMIN?.trim();
  if (!adminUrl) throw new Error("DATABASE_URL_ADMIN required");
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
    "x-workspace-id": "ws-ticketing-e1",
  };
}

function createMemoryObjectStorage(): TenantObjectStoragePort & {
  readonly objects: Map<string, { body: Buffer; contentType: string }>;
} {
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  return {
    objects,
    async put(input) {
      assertTenantOwnsObjectKey(input.storageKey, input.tenantId);
      objects.set(input.storageKey, { body: input.body, contentType: input.contentType });
    },
    async getSignedReadUrl(input) {
      assertTenantOwnsObjectKey(input.storageKey, input.tenantId);
      if (!objects.has(input.storageKey)) throw new Error("OBJECT_NOT_FOUND");
      return `memory://signed/${input.tenantId}/${encodeURIComponent(input.storageKey)}`;
    },
    async remove(input) {
      assertTenantOwnsObjectKey(input.storageKey, input.tenantId);
      objects.delete(input.storageKey);
    },
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
            ...(input.idempotencyKey !== undefined ? { "idempotency-key": input.idempotencyKey } : {}),
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

async function requestBinary(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly tenantId: string;
    readonly userId: string;
    readonly role?: "admin" | "owner" | "member" | "viewer";
    readonly body: Buffer;
    readonly contentType?: string;
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
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: input.path,
          method: input.method,
          headers: {
            "Content-Type": input.contentType ?? "application/pdf",
            "Content-Length": String(input.body.length),
            ...authHeaders({
              tenantId: input.tenantId,
              userId: input.userId,
              role: input.role,
            }),
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
              try {
                body = JSON.parse(text) as Record<string, unknown>;
              } catch {
                body = { raw: text };
              }
            }
            resolve({ status: res.statusCode ?? 0, body });
          });
        },
      );
      req.on("error", (error) => {
        server.close();
        reject(error);
      });
      req.write(input.body);
      req.end();
    });
  });
}

describe(
  "ticketing-attachments-e1-postgres.spec.ts — TKT-001 Phase E1",
  { concurrency: false, skip: postgresSkip },
  () => {
    const tenantDenali = integrationTenantId();
    const tenantOther = integrationTenantId();
    const memberDenali = randomUUID();
    const memberOther = randomUUID();
    const adminDenali = randomUUID();
    const viewerDenali = randomUUID();
    const tourDenali = randomUUID();
    let admin: PrismaClient;
  let memoryStorage: ReturnType<typeof createMemoryObjectStorage>;
    const listener = createRequestListener();
    let ticketId = "";
    let publicMessageId = "";
    let internalMessageId = "";

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.OUTBOX_RELAY_ENABLED = "false";
      resetLazyTicketingServiceForTests();
      memoryStorage = createMemoryObjectStorage();
      setTenantObjectStorageForTests(memoryStorage);

      admin = new PrismaClient({ datasources: { db: { url: resolveAdminUrl() } } });
      await admin.tenant.createMany({
        data: [
          {
            id: tenantDenali,
            subdomain: `tkt-e1-d-${tenantDenali.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing"] },
          },
          {
            id: tenantOther,
            subdomain: `tkt-e1-o-${tenantOther.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing"] },
          },
        ],
      });
      await admin.user.createMany({
        data: [
          { id: memberDenali, mobile: `+98912${memberDenali.replace(/-/g, "").slice(0, 8)}` },
          { id: memberOther, mobile: `+98912${memberOther.replace(/-/g, "").slice(0, 8)}` },
          { id: adminDenali, mobile: `+98912${adminDenali.replace(/-/g, "").slice(0, 8)}` },
          { id: viewerDenali, mobile: `+98912${viewerDenali.replace(/-/g, "").slice(0, 8)}` },
        ],
      });
      await admin.userTenant.createMany({
        data: [
          { tenantId: tenantDenali, userId: memberDenali, role: "member", status: "ACTIVE" },
          { tenantId: tenantDenali, userId: adminDenali, role: "admin", status: "ACTIVE" },
          { tenantId: tenantDenali, userId: viewerDenali, role: "viewer", status: "ACTIVE" },
          { tenantId: tenantOther, userId: memberOther, role: "member", status: "ACTIVE" },
        ],
      });
      await admin.tour.create({
        data: {
          id: tourDenali,
          tenantId: tenantDenali,
          title: "E1 Tour",
          publishStatus: "published",
          canonical: { schemaVersion: 1, roots: [], data: { title: "E1 Tour" } },
        },
      });
    });

    beforeEach(async () => {
      resetLazyTicketingServiceForTests();
      memoryStorage.objects.clear();
      setTenantObjectStorageForTests(memoryStorage);
      for (const tenantId of [tenantDenali, tenantOther]) {
        await admin.ticketAttachment.deleteMany({ where: { tenantId } });
        await admin.ticketLink.deleteMany({ where: { tenantId } });
        await admin.ticketMessage.deleteMany({ where: { tenantId } });
        await admin.ticketEvent.deleteMany({ where: { tenantId } });
        await admin.ticket.deleteMany({ where: { tenantId } });
      }

      const created = await requestJson(listener, {
        method: "POST",
        path: "/member/tickets",
        tenantId: tenantDenali,
        userId: memberDenali,
        idempotencyKey: `create-${randomUUID()}`,
        body: {
          categoryCode: "general",
          subject: "Attachment E1 ticket",
          body: "Need help",
        },
      });
      assert.equal(created.status, 201);
      const envelope = created.body.ticket as Record<string, unknown>;
      const summary = envelope.ticket as Record<string, unknown>;
      ticketId = String(summary.id ?? "");
      const messages = envelope.messages as Array<Record<string, unknown>>;
      publicMessageId = String(messages[0]?.id ?? "");

      const note = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/internal-notes`,
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `note-${randomUUID()}`,
        body: { body: "internal only" },
      });
      assert.equal(note.status, 201);
      internalMessageId = String((note.body.message as Record<string, unknown>).id);
    });

    after(async () => {
      setTenantObjectStorageForTests(null);
      await admin.$disconnect();
      await disconnectPrisma();
    });

    it("runs E1 migration columns on ticket_attachments", async () => {
      const columns = await admin.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'ticket_attachments'
           AND column_name IN ('scan_status', 'uploaded_at', 'idempotency_key', 'upload_intent_expires_at')
         ORDER BY column_name`,
      );
      assert.deepEqual(
        columns.map((row) => row.column_name),
        ["idempotency_key", "scan_status", "upload_intent_expires_at", "uploaded_at"],
      );
    });

    it("member completes 3-step upload on public message", async () => {
      const intentKey = `intent-${randomUUID()}`;
      const intent = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/attachments/intents`,
        tenantId: tenantDenali,
        userId: memberDenali,
        idempotencyKey: intentKey,
        body: {
          messageId: publicMessageId,
          originalFileName: "proof.pdf",
          contentType: "application/pdf",
          sizeBytes: 12,
        },
      });
      assert.equal(intent.status, 201);
      const attachmentId = String(intent.body.attachmentId);
      assert.ok(attachmentId.length > 0);

      const upload = await requestBinary(listener, {
        method: "PUT",
        path: `/member/tickets/${ticketId}/attachments/${attachmentId}/upload`,
        tenantId: tenantDenali,
        userId: memberDenali,
        body: Buffer.from("%PDF-1.4-e1"),
      });
      assert.equal(upload.status, 204);

      const complete = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/messages/${publicMessageId}/attachments/${attachmentId}/complete`,
        tenantId: tenantDenali,
        userId: memberDenali,
        idempotencyKey: `complete-${randomUUID()}`,
      });
      assert.equal(complete.status, 200, JSON.stringify(complete.body));
      assert.equal(complete.body.scanStatus, "clean");
      assert.match(String(complete.body.readUrl), /^memory:\/\//);

      const row = await admin.ticketAttachment.findFirst({ where: { id: attachmentId } });
      assert.equal(row?.scanStatus, "clean");
      assert.ok(row?.objectKey.startsWith(`tickets/${tenantDenali}/`));
      assertTenantOwnsObjectKey(row!.objectKey, tenantDenali);

      const events = await admin.ticketEvent.findMany({
        where: { tenantId: tenantDenali, ticketId, eventType: "attachment.completed" },
      });
      assert.equal(events.length, 1);
    });

    it("rejects unsupported content type and oversize intent", async () => {
      const badType = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/attachments/intents`,
        tenantId: tenantDenali,
        userId: memberDenali,
        idempotencyKey: `bad-type-${randomUUID()}`,
        body: {
          messageId: publicMessageId,
          originalFileName: "x.exe",
          contentType: "application/x-msdownload",
          sizeBytes: 100,
        },
      });
      assert.equal(badType.status, 422);

      const tooLarge = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/attachments/intents`,
        tenantId: tenantDenali,
        userId: memberDenali,
        idempotencyKey: `too-large-${randomUUID()}`,
        body: {
          messageId: publicMessageId,
          originalFileName: "big.pdf",
          contentType: "application/pdf",
          sizeBytes: 20_000_000,
        },
      });
      assert.equal(tooLarge.status, 413);
    });

    it("member cannot attach to internal message", async () => {
      const denied = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/attachments/intents`,
        tenantId: tenantDenali,
        userId: memberDenali,
        idempotencyKey: `internal-${randomUUID()}`,
        body: {
          messageId: internalMessageId,
          originalFileName: "secret.pdf",
          contentType: "application/pdf",
          sizeBytes: 10,
        },
      });
      assert.equal(denied.status, 404);
    });

    it("intent idempotency returns same attachmentId", async () => {
      const key = `idem-${randomUUID()}`;
      const first = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/attachments/intents`,
        tenantId: tenantDenali,
        userId: memberDenali,
        idempotencyKey: key,
        body: {
          messageId: publicMessageId,
          originalFileName: "dup.pdf",
          contentType: "application/pdf",
          sizeBytes: 8,
        },
      });
      const second = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/attachments/intents`,
        tenantId: tenantDenali,
        userId: memberDenali,
        idempotencyKey: key,
        body: {
          messageId: publicMessageId,
          originalFileName: "dup.pdf",
          contentType: "application/pdf",
          sizeBytes: 8,
        },
      });
      assert.equal(first.status, 201);
      assert.equal(second.status, 201);
      assert.equal(first.body.attachmentId, second.body.attachmentId);
    });

    it("cross-tenant ticket access denied", async () => {
      const denied = await requestJson(listener, {
        method: "GET",
        path: `/member/tickets/${ticketId}`,
        tenantId: tenantOther,
        userId: memberOther,
      });
      assert.equal(denied.status, 404);
    });

    it("viewer can download clean attachment; member denied on internal attachment metadata", async () => {
      const intent = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/attachments/intents`,
        tenantId: tenantDenali,
        userId: memberDenali,
        idempotencyKey: `viewer-${randomUUID()}`,
        body: {
          messageId: publicMessageId,
          originalFileName: "viewer.pdf",
          contentType: "application/pdf",
          sizeBytes: 5,
        },
      });
      const attachmentId = String(intent.body.attachmentId);
      await requestBinary(listener, {
        method: "PUT",
        path: `/member/tickets/${ticketId}/attachments/${attachmentId}/upload`,
        tenantId: tenantDenali,
        userId: memberDenali,
        body: Buffer.from("%PDF"),
      });
      const complete = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/messages/${publicMessageId}/attachments/${attachmentId}/complete`,
        tenantId: tenantDenali,
        userId: memberDenali,
        idempotencyKey: `viewer-complete-${randomUUID()}`,
      });
      assert.equal(complete.status, 200);

      const viewerGet = await requestJson(listener, {
        method: "GET",
        path: `/member/tickets/${ticketId}/attachments/${attachmentId}`,
        tenantId: tenantDenali,
        userId: viewerDenali,
        role: "viewer",
      });
      assert.equal(viewerGet.status, 200);

      await withTenantRls(tenantDenali, async (tx) => {
        await tx.ticketAttachment.create({
          data: {
            tenantId: tenantDenali,
            ticketId,
            messageId: internalMessageId,
            uploadedByUserId: adminDenali,
            objectKey: `tickets/${tenantDenali}/${ticketId}/${internalMessageId}/${randomUUID()}`,
            originalFileName: "internal.pdf",
            contentType: "application/pdf",
            sizeBytes: 10,
            scanStatus: "clean",
            uploadedAt: new Date(),
          },
        });
      });

      const detail = await requestJson(listener, {
        method: "GET",
        path: `/member/tickets/${ticketId}`,
        tenantId: tenantDenali,
        userId: memberDenali,
      });
      const messages = (detail.body.messages as Array<Record<string, unknown>>) ?? [];
      assert.equal(messages.length, 1);
      assert.equal((messages[0]?.attachments as unknown[] | undefined)?.length ?? 0, 1);
    });

    it("admin creates and deletes ticket link; duplicate rejected", async () => {
      const create = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/links`,
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `link-${randomUUID()}`,
        body: { entityType: "tour", entityId: tourDenali },
      });
      assert.equal(create.status, 201);
      const linkId = String(create.body.id);

      const dup = await requestJson(listener, {
        method: "POST",
        path: `/tickets/${ticketId}/links`,
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
        idempotencyKey: `link-dup-${randomUUID()}`,
        body: { entityType: "tour", entityId: tourDenali },
      });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, "TICKET_LINK_DUPLICATE");

      const list = await requestJson(listener, {
        method: "GET",
        path: `/tickets/${ticketId}/links`,
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
      });
      assert.equal(list.status, 200);
      const items = list.body.items as unknown[];
      assert.equal(items.length, 1);

      const deleted = await requestJson(listener, {
        method: "DELETE",
        path: `/tickets/${ticketId}/links/${linkId}`,
        tenantId: tenantDenali,
        userId: adminDenali,
        role: "admin",
      });
      assert.equal(deleted.status, 204);

      const events = await admin.ticketEvent.findMany({
        where: {
          tenantId: tenantDenali,
          ticketId,
          eventType: { in: ["ticket.link.created", "ticket.link.deleted"] },
        },
      });
      assert.equal(events.length, 2);
    });

    it("member may link tour only; payment link denied", async () => {
      const allowed = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/links`,
        tenantId: tenantDenali,
        userId: memberDenali,
        idempotencyKey: `member-link-${randomUUID()}`,
        body: { entityType: "tour", entityId: tourDenali },
      });
      assert.equal(allowed.status, 201);

      const denied = await requestJson(listener, {
        method: "POST",
        path: `/member/tickets/${ticketId}/links`,
        tenantId: tenantDenali,
        userId: memberDenali,
        idempotencyKey: `member-pay-${randomUUID()}`,
        body: { entityType: "payment", entityId: randomUUID() },
      });
      assert.equal(denied.status, 404);
    });

    it("RLS blocks cross-tenant ticket_link insert", async () => {
      let rejected = false;
      try {
        await withTenantRls(tenantOther, async (tx) => {
          await tx.ticketLink.create({
            data: {
              tenantId: tenantDenali,
              ticketId,
              entityType: "tour",
              entityId: tourDenali,
            },
          });
        });
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true);
    });
  },
);
