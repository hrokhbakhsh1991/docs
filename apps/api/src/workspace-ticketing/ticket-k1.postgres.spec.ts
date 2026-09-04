/**
 * TKT-001 Phase K1 — search, reports, settings (Postgres + RLS).
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { formatTicketCode } from "@app-tour/ticketing-core";

import { createRequestListener } from "../app";
import { resetLazyTicketingServiceForTests } from "../boot/lazy-ticketing-service";
import { disconnectPrisma, getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import { integrationTenantId } from "../../test/test-helpers";
import {
  buildTicketReportCacheKey,
  clearTicketReportCacheForTests,
  getTicketReportSummary,
  readTicketReportCache,
  writeTicketReportCache,
} from "./ticket-report.repository";
import {
  getTicketWorkspaceSettings,
  updateTicketWorkspaceSettings,
} from "./ticket-settings.repository";
import { nextPostgresTestTicketNumber } from "./ticketing-postgres-test-helpers";
import { PrismaTicketingRepository } from "./infrastructure/prisma-ticketing.repository";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const postgresSkip =
  !hasDatabase
    ? "TICKET_K1_REQUIRES_DATABASE"
    : process.env.STORAGE_DRIVER?.trim().toLowerCase() !== "prisma"
      ? "TICKET_K1_REQUIRES_STORAGE_DRIVER=prisma"
      : false;

const repository = new PrismaTicketingRepository();

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
    "x-workspace-id": "ws-ticket-k1-pg",
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
): Promise<{ status: number; body: Record<string, unknown>; headers: http.IncomingHttpHeaders }> {
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
            resolve({ status: res.statusCode ?? 0, body, headers: res.headers });
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
  "ticket-k1.postgres.spec.ts — TKT-001 Phase K1",
  { skip: postgresSkip, concurrency: false },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const adminA = randomUUID();
    const viewerA = randomUUID();
    const requesterA = randomUUID();
    const priorDriver = process.env.STORAGE_DRIVER;
    let listener: ReturnType<typeof createRequestListener>;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      resetLazyTicketingServiceForTests();
      clearTicketReportCacheForTests();
      listener = createRequestListener({});
      const admin = getPrismaAdmin();
      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `k1-a-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing"] },
          },
          {
            id: tenantB,
            subdomain: `k1-b-${tenantB.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing"] },
          },
        ],
      });
      await admin.user.createMany({
        data: [{ id: requesterA, mobile: "+15550009901" }],
        skipDuplicates: true,
      });
      await admin.userTenant.createMany({
        data: [
          {
            userId: requesterA,
            tenantId: tenantA,
            role: "member",
            status: "ACTIVE",
          },
        ],
        skipDuplicates: true,
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      clearTicketReportCacheForTests();
      const admin = getPrismaAdmin();
      try {
        await admin.ticketWorkspaceSettings.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.operatorSettingsAuditEvent.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] }, resourceType: "ticketing_settings" },
        });
        await admin.ticket.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.ticketNumberCounter.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.userTenant.deleteMany({
          where: { tenantId: tenantA, userId: requesterA },
        });
        await admin.user.deleteMany({ where: { id: requesterA } });
        await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      } finally {
        await disconnectPrisma();
      }
    });

    it("searches by subject, ticket code, and requester mobile", async () => {
      const ticketId = randomUUID();
      const ticketNumber = nextPostgresTestTicketNumber();
      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketId,
            tenantId: tenantA,
            requesterUserId: requesterA,
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "UniqueSearchSubject K1",
            ticketNumber,
            lastActivityAt: new Date(),
          },
        });
      });

      const bySubject = await repository.findOperatorTickets({
        tenantId: tenantA,
        q: "UniqueSearchSubject",
        limit: 20,
        sort: "lastActivityAt",
      });
      assert.ok(bySubject.items.some((item) => item.ticket.id === ticketId));

      const byCode = await repository.findOperatorTickets({
        tenantId: tenantA,
        q: formatTicketCode(ticketNumber),
        limit: 20,
        sort: "lastActivityAt",
      });
      assert.ok(byCode.items.some((item) => item.ticket.id === ticketId));

      const byRequester = await repository.findOperatorTickets({
        tenantId: tenantA,
        q: "9901",
        limit: 20,
        sort: "lastActivityAt",
      });
      assert.ok(byRequester.items.some((item) => item.ticket.id === ticketId));
    });

    it("paginates stably with sort and cursor", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const id = randomUUID();
        ids.push(id);
        await withTenantRls(tenantA, async (tx) => {
          await tx.ticket.create({
            data: {
              id,
              tenantId: tenantA,
              requesterUserId: requesterA,
              categoryCode: "general",
              priority: "normal",
              status: "open",
              subject: `Paginate ${i}`,
              ticketNumber: nextPostgresTestTicketNumber(),
              createdAt: new Date(Date.now() - i * 60_000),
              lastActivityAt: new Date(Date.now() - i * 60_000),
            },
          });
        });
      }

      const page1 = await repository.findOperatorTickets({
        tenantId: tenantA,
        limit: 2,
        sort: "createdAt",
      });
      assert.equal(page1.items.length, 2);
      assert.ok(page1.hasMore);
      assert.ok(page1.nextCursor);

      const page2 = await repository.findOperatorTickets({
        tenantId: tenantA,
        limit: 2,
        sort: "createdAt",
        cursor: page1.nextCursor ?? undefined,
      });
      assert.ok(page2.items.length >= 1);
      const seen = new Set([...page1.items, ...page2.items].map((item) => item.ticket.id));
      assert.equal(seen.size, page1.items.length + page2.items.length);
    });

    it("aggregates tenant-scoped report summary and caches by tenant", async () => {
      const summary = await getTicketReportSummary(tenantA, {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-12-31T23:59:59.999Z"),
      });
      assert.ok(summary.ticketCount >= 1);
      assert.ok(typeof summary.statusDistribution === "object");

      const key = buildTicketReportCacheKey(
        tenantA,
        summary.window.from,
        summary.window.to,
      );
      assert.ok(readTicketReportCache(key));

      writeTicketReportCache(key, {
        ...summary,
        ticketCount: 888,
      });
      const tenantBSummary = await getTicketReportSummary(tenantB, {
        from: new Date(summary.window.from),
        to: new Date(summary.window.to),
      });
      assert.notEqual(tenantBSummary.ticketCount, 888);
      clearTicketReportCacheForTests();
    });

    it("enforces export authorization and settings permissions", async () => {
      const viewerExport = await requestJson(listener, {
        method: "GET",
        path: "/ticket-reports/export?format=json",
        tenantId: tenantA,
        userId: viewerA,
        role: "viewer",
      });
      assert.equal(viewerExport.status, 403);

      const adminExport = await requestJson(listener, {
        method: "GET",
        path: "/ticket-reports/export?format=json&limit=10",
        tenantId: tenantA,
        userId: adminA,
        role: "admin",
      });
      assert.equal(adminExport.status, 200);
      const rows = adminExport.body.rows as unknown[];
      assert.ok(Array.isArray(rows));
      assert.ok(rows.length <= 10);

      const viewerSettings = await requestJson(listener, {
        method: "GET",
        path: "/ticket-settings",
        tenantId: tenantA,
        userId: viewerA,
        role: "viewer",
      });
      assert.equal(viewerSettings.status, 200);

      const viewerPatch = await requestJson(listener, {
        method: "PATCH",
        path: "/ticket-settings",
        tenantId: tenantA,
        userId: viewerA,
        role: "viewer",
        body: { enabled: false, rowVersion: 1 },
      });
      assert.equal(viewerPatch.status, 403);

      const settings = await getTicketWorkspaceSettings(tenantA);
      assert.ok(settings);
      assert.ok(settings?.categories.some((category) => category.code === "general"));

      const updated = await updateTicketWorkspaceSettings(tenantA, {
        enabled: true,
        disabledCategoryCodes: ["billing"],
        rowVersion: settings!.rowVersion,
        updatedByUserId: adminA,
      });
      assert.ok(updated);
      assert.ok(updated?.categories.find((category) => category.code === "billing")?.enabled === false);

      const audits = await withTenantRls(tenantA, async (tx) =>
        tx.operatorSettingsAuditEvent.findMany({
          where: { tenantId: tenantA, resourceType: "ticketing_settings" },
        }),
      );
      assert.ok(audits.length >= 1);
    });

    it("enforces tenant isolation for search and reports", async () => {
      const leaked = await repository.findOperatorTickets({
        tenantId: tenantA,
        q: "UniqueSearchSubject",
        limit: 20,
        sort: "lastActivityAt",
      });
      const foreign = await getTicketReportSummary(tenantB, {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-12-31T23:59:59.999Z"),
      });
      assert.ok(!leaked.items.some((item) => item.ticket.tenantId === tenantB));
      assert.equal(foreign.ticketCount, 0);
    });
  },
);
