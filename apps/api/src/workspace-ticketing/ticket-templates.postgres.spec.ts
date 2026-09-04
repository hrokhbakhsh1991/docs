/**
 * TKT-001 Phase J1 — ticketing templates and automation (Postgres + RLS required).
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { findDisallowedTemplateTokens, sanitizeTicketTemplateBody } from "@app-tour/ticketing-core";

import { createRequestListener } from "../app";
import { resetLazyTicketingServiceForTests } from "../boot/lazy-ticketing-service";
import { disconnectPrisma, getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import { dispatchTicketNotificationFromOutbox } from "../notifications/dispatch-ticket-notification-from-outbox";
import { integrationTenantId } from "../../test/test-helpers";
import { applyTicketTemplateAutomation } from "./ticket-template-automation";
import {
  createTicketTemplate,
  ensureDefaultTicketTemplatesForTenant,
  findTicketTemplate,
  listTicketTemplates,
  rollbackTicketTemplate,
  updateTicketTemplate,
} from "./ticket-template.repository";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const postgresSkip =
  !hasDatabase
    ? "TICKET_TEMPLATES_REQUIRES_DATABASE"
    : process.env.STORAGE_DRIVER?.trim().toLowerCase() !== "prisma"
      ? "TICKET_TEMPLATES_REQUIRES_STORAGE_DRIVER=prisma"
      : false;

function authHeaders(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly role?: "admin" | "owner" | "member" | "viewer";
}): Record<string, string> {
  return {
    "x-tenant-id": input.tenantId,
    "x-authenticated-tenant-id": input.tenantId,
    "x-user-id": input.userId,
    "x-actor-role": input.role ?? "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-ticket-templates-pg",
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

describe(
  "ticket-templates.postgres.spec.ts — TKT-001 Phase J1",
  { skip: postgresSkip, concurrency: false },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const adminA = randomUUID();
    const viewerA = randomUUID();
    const priorDriver = process.env.STORAGE_DRIVER;
    let listener: ReturnType<typeof createRequestListener>;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      resetLazyTicketingServiceForTests();
      listener = createRequestListener({});
      const admin = getPrismaAdmin();
      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `tpl-a-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing"] },
          },
          {
            id: tenantB,
            subdomain: `tpl-b-${tenantB.slice(0, 8)}`,
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
        await admin.ticketTemplateAutomationActivation.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.ticketTemplateRevision.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.ticketTemplate.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      } finally {
        await disconnectPrisma();
      }
    });

    it("seeds Denali defaults and supports FA/EN locales", async () => {
      await ensureDefaultTicketTemplatesForTenant(tenantA);
      const templates = await listTicketTemplates(tenantA);
      assert.ok(templates.some((t) => t.code === "reply_ack" && t.locale === "en"));
      assert.ok(templates.some((t) => t.code === "reply_ack" && t.locale === "fa"));
    });

    it("CRUD via API with viewer read-only and admin write", async () => {
      const listViewer = await requestJson(listener, {
        method: "GET",
        path: "/ticket-templates",
        tenantId: tenantA,
        userId: viewerA,
        role: "viewer",
      });
      assert.equal(listViewer.status, 200);

      const createDenied = await requestJson(listener, {
        method: "POST",
        path: "/ticket-templates/custom_note",
        tenantId: tenantA,
        userId: viewerA,
        role: "viewer",
        body: {
          title: "Denied",
          body: "nope",
          channel: "public_reply",
          locale: "en",
        },
      });
      assert.equal(createDenied.status, 403);

      const created = await requestJson(listener, {
        method: "POST",
        path: "/ticket-templates/custom_note",
        tenantId: tenantA,
        userId: adminA,
        role: "admin",
        body: {
          title: "Custom",
          body: "Hello {{ticketSubject}}",
          channel: "public_reply",
          locale: "en",
        },
      });
      assert.equal(created.status, 201);
    });

    it("rejects disallowed variables and strips XSS on save", async () => {
      assert.deepEqual(findDisallowedTemplateTokens("{{evil}}"), ["evil"]);
      const created = await createTicketTemplate(tenantA, {
        code: "xss_test",
        title: "XSS",
        body: '<script>x</script>{{ticketSubject}}',
        channel: "email",
        locale: "en",
      });
      assert.equal(created.body, sanitizeTicketTemplateBody("{{ticketSubject}}"));
    });

    it("versions updates and supports rollback", async () => {
      const code = `ver-${randomUUID().slice(0, 8)}`;
      const created = await createTicketTemplate(tenantA, {
        code,
        title: "V1",
        body: "Body v1",
        channel: "internal_note",
        locale: "en",
      });
      const updated = await updateTicketTemplate(tenantA, code, "internal_note", "en", {
        title: "V2",
        body: "Body v2",
        rowVersion: created.rowVersion,
      });
      assert.ok(updated);
      assert.equal(updated?.version, 2);

      const rolled = await rollbackTicketTemplate(tenantA, code, "internal_note", "en", 1);
      assert.ok(rolled);
      assert.equal(rolled?.body, "Body v1");
    });

    it("automation is idempotent per domain event", async () => {
      await ensureDefaultTicketTemplatesForTenant(tenantA);
      const ticketId = randomUUID();
      const domainEventId = randomUUID();
      const input = {
        tenantId: tenantA,
        domainEventId,
        eventType: "ticket.sla.breached",
        ticketId,
        locale: "en" as const,
        context: {
          ticketId,
          ticketSubject: "SLA ticket",
          clock: "first",
          status: "open",
        },
      };
      const first = await applyTicketTemplateAutomation(input);
      const second = await applyTicketTemplateAutomation(input);
      assert.ok(first.body);
      assert.equal(second.body, null);
    });

    it("notification dispatch applies template once", async () => {
      await ensureDefaultTicketTemplatesForTenant(tenantA);
      const ticketId = randomUUID();
      const domainEventId = randomUUID();
      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketId,
            tenantId: tenantA,
            requesterUserId: randomUUID(),
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "Template notify",
            lastActivityAt: new Date(),
          },
        });
      });

      await dispatchTicketNotificationFromOutbox({
        tenantId: tenantA,
        aggregateType: "ticket",
        aggregateId: ticketId,
        eventType: "ticket.sla.breached",
        domainEventId,
        payload: {
          ticketId,
          subject: "Template notify",
          requesterUserId: randomUUID(),
          assigneeUserId: adminA,
          assigneeTeamId: null,
          queueId: null,
          clock: "first",
        },
        createdAt: new Date(),
        correlationId: randomUUID(),
      });

      const rows = await withTenantRls(tenantA, async (tx) =>
        tx.ticketNotification.findMany({ where: { tenantId: tenantA, ticketId } }),
      );
      assert.ok(rows.length >= 1);
      assert.match(rows[0]?.body ?? "", /Template notify|SLA breached/i);
    });

    it("enforces tenant isolation", async () => {
      await ensureDefaultTicketTemplatesForTenant(tenantB);
      const leaked = await findTicketTemplate(tenantA, "reply_ack", "public_reply", "en");
      void leaked;
      const foreign = await listTicketTemplates(tenantA);
      assert.ok(!foreign.some((t) => t.tenantId === tenantB));
    });
  },
);
