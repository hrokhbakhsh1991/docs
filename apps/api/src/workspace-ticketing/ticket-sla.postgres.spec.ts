/**
 * TKT-001 Phase I1 — ticketing SLA and escalation (Postgres + RLS required).
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../app";
import { resetLazyTicketingServiceForTests } from "../boot/lazy-ticketing-service";
import { disconnectPrisma, getPrisma, getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import { dispatchTicketNotificationFromOutbox } from "../notifications/dispatch-ticket-notification-from-outbox";
import {
  assertPostgresAppRoleForRlsTests,
  nextPostgresTestTicketNumber,
} from "./ticketing-postgres-test-helpers";
import { integrationTenantId } from "../../test/test-helpers";
import { processTicketSlaOnce } from "./process-ticket-sla-once";
import {
  createTicketSlaPolicy,
  getTicketSlaState,
  syncTicketSlaStateForTicket,
  tryActivateTicketSlaEscalation,
} from "./ticket-sla.repository";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const hasPrismaDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase() === "prisma";

const postgresSkip = !hasDatabase
  ? "TICKET_SLA_REQUIRES_DATABASE"
  : !hasPrismaDriver
    ? "TICKET_SLA_REQUIRES_STORAGE_DRIVER=prisma"
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
    "x-workspace-id": "ws-ticket-sla-pg",
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
  "ticket-sla.postgres.spec.ts — TKT-001 Phase I1",
  { skip: postgresSkip, concurrency: false },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const adminA = randomUUID();
    const viewerA = randomUUID();
    const memberA = randomUUID();
    const priorDriver = process.env.STORAGE_DRIVER;
    const priorSlaWorker = process.env.TICKETING_SLA_WORKER_ENABLED;
    let listener: ReturnType<typeof createRequestListener>;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.TICKETING_SLA_WORKER_ENABLED = "true";
      await assertPostgresAppRoleForRlsTests(getPrisma());
      resetLazyTicketingServiceForTests();
      listener = createRequestListener({});
      const admin = getPrismaAdmin();
      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `sla-a-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing"] },
          },
          {
            id: tenantB,
            subdomain: `sla-b-${tenantB.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing"] },
          },
        ],
      });
      await createTicketSlaPolicy(tenantA, {
        code: "default",
        name: "Default SLA",
        workspaceType: "denali",
        firstResponseMinutes: 60,
        nextResponseMinutes: 30,
        resolutionMinutes: 240,
        businessHoursJson: {
          timezone: "Asia/Tehran",
          weekly: {
            mon: [{ start: "00:00", end: "23:59" }],
            tue: [{ start: "00:00", end: "23:59" }],
            wed: [{ start: "00:00", end: "23:59" }],
            thu: [{ start: "00:00", end: "23:59" }],
            fri: [{ start: "00:00", end: "23:59" }],
            sat: [{ start: "00:00", end: "23:59" }],
            sun: [{ start: "00:00", end: "23:59" }],
          },
        },
        escalationStepsJson: [{ level: 1, afterMinutes: 1, action: "notify_team" }],
        warningThresholdPercent: 50,
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      process.env.TICKETING_SLA_WORKER_ENABLED = priorSlaWorker;
      const admin = getPrismaAdmin();
      try {
        await admin.ticketNotificationDelivery.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.ticketNotification.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.outboxEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.ticketSlaEscalationActivation.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.ticketSlaState.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.ticketSlaPolicy.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.ticketEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.ticketMessage.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.ticket.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      } finally {
        await disconnectPrisma();
      }
    });

    it("calculates deadlines idempotently and pauses on hold", async () => {
      const ticketId = randomUUID();
      const createdAt = "2026-09-07T08:00:00.000Z";
      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketId,
            tenantId: tenantA,
            requesterUserId: memberA,
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "SLA pause",
            ticketNumber: nextPostgresTestTicketNumber(),
            onHold: false,
            lastActivityAt: new Date(createdAt),
            createdAt: new Date(createdAt),
          },
        });
      });

      const first = await syncTicketSlaStateForTicket(tenantA, ticketId, {
        workspaceType: "denali",
        categoryCode: "general",
        priority: "normal",
        queueId: null,
        status: "open",
        createdAt,
        onHold: false,
        nowIso: "2026-09-07T08:05:00.000Z",
      });
      const second = await syncTicketSlaStateForTicket(tenantA, ticketId, {
        workspaceType: "denali",
        categoryCode: "general",
        priority: "normal",
        queueId: null,
        status: "open",
        createdAt,
        onHold: false,
        nowIso: "2026-09-07T08:05:00.000Z",
      });
      assert.equal(first?.firstResponseDueAt, second?.firstResponseDueAt);

      const paused = await syncTicketSlaStateForTicket(tenantA, ticketId, {
        workspaceType: "denali",
        categoryCode: "general",
        priority: "normal",
        queueId: null,
        status: "open",
        createdAt,
        onHold: true,
        nowIso: "2026-09-07T08:10:00.000Z",
      });
      assert.ok(paused?.pausedAt);
      assert.ok(
        Date.parse(paused?.firstResponseDueAt ?? "") >= Date.parse(first?.firstResponseDueAt ?? ""),
      );
    });

    it("worker emits warning, breach, and idempotent escalation", async () => {
      const ticketId = randomUUID();
      const createdAt = new Date(Date.now() - 120_000);
      const dueAt = new Date(Date.now() - 60_000);
      const policy = await createTicketSlaPolicy(tenantA, {
        code: `fast-${ticketId.slice(0, 8)}`,
        name: "Fast SLA",
        workspaceType: "denali",
        firstResponseMinutes: 1,
        nextResponseMinutes: 1,
        resolutionMinutes: 1,
        businessHoursJson: {
          timezone: "UTC",
          weekly: {
            mon: [{ start: "00:00", end: "23:59" }],
            tue: [{ start: "00:00", end: "23:59" }],
            wed: [{ start: "00:00", end: "23:59" }],
            thu: [{ start: "00:00", end: "23:59" }],
            fri: [{ start: "00:00", end: "23:59" }],
            sat: [{ start: "00:00", end: "23:59" }],
            sun: [{ start: "00:00", end: "23:59" }],
          },
        },
        escalationStepsJson: [{ level: 1, afterMinutes: 1, action: "notify_team" }],
        warningThresholdPercent: 50,
      });

      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketId,
            tenantId: tenantA,
            requesterUserId: memberA,
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "SLA worker",
            ticketNumber: nextPostgresTestTicketNumber(),
            lastActivityAt: createdAt,
            createdAt,
          },
        });
        await tx.ticketSlaState.create({
          data: {
            tenantId: tenantA,
            ticketId,
            policyId: policy.id,
            firstResponseDueAt: dueAt,
            resolutionDueAt: dueAt,
            escalationLevel: 0,
          },
        });
      });

      const first = await processTicketSlaOnce(20);
      const second = await processTicketSlaOnce(20);
      assert.ok(first.warnings + first.breaches + first.escalations > 0);
      assert.equal(second.escalations, 0);

      const state = await getTicketSlaState(tenantA, ticketId);
      assert.ok(state?.breachedAt);
      assert.equal(state?.escalationLevel, 1);
      assert.equal(await tryActivateTicketSlaEscalation(tenantA, ticketId, 1), false);
    });

    it("dispatches SLA notifications from outbox", async () => {
      const ticketId = randomUUID();
      const domainEventId = randomUUID();
      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketId,
            tenantId: tenantA,
            requesterUserId: memberA,
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "SLA notify",
            ticketNumber: nextPostgresTestTicketNumber(),
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
          subject: "SLA notify",
            ticketNumber: nextPostgresTestTicketNumber(),
          requesterUserId: memberA,
          assigneeUserId: adminA,
          assigneeTeamId: null,
          queueId: null,
          clock: "first",
        },
        createdAt: new Date(),
        correlationId: randomUUID(),
      });

      const rows = await withTenantRls(tenantA, async (tx) =>
        tx.memberNotification.findMany({
          where: {
            tenantId: tenantA,
            entityType: "ticket",
            entityId: ticketId,
            eventType: "ticket.sla.breached",
          },
        }),
      );
      assert.ok(rows.length >= 1);
      assert.equal(rows[0]?.eventType, "ticket.sla.breached");
    });

    it("enforces cross-tenant RLS isolation", async () => {
      const ticketId = randomUUID();
      await withTenantRls(tenantB, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketId,
            tenantId: tenantB,
            requesterUserId: memberA,
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "Tenant B",
            ticketNumber: nextPostgresTestTicketNumber(),
            lastActivityAt: new Date(),
          },
        });
      });
      const leaked = await getTicketSlaState(tenantA, ticketId);
      assert.equal(leaked, null);
    });

    it("policy API permission matrix and operator ticket includes sla", async () => {
      const listViewer = await requestJson(listener, {
        method: "GET",
        path: "/ticket-sla-policies",
        tenantId: tenantA,
        userId: viewerA,
        role: "viewer",
      });
      assert.equal(listViewer.status, 200);

      const createViewer = await requestJson(listener, {
        method: "POST",
        path: "/ticket-sla-policies/viewer-denied",
        tenantId: tenantA,
        userId: viewerA,
        role: "viewer",
        body: {
          name: "Denied",
          firstResponseMinutes: 60,
          nextResponseMinutes: 30,
          resolutionMinutes: 240,
        },
      });
      assert.equal(createViewer.status, 403);

      const ticketId = randomUUID();
      await withTenantRls(tenantA, async (tx) => {
        await tx.ticket.create({
          data: {
            id: ticketId,
            tenantId: tenantA,
            requesterUserId: memberA,
            categoryCode: "general",
            priority: "normal",
            status: "open",
            subject: "Operator SLA detail",
            ticketNumber: nextPostgresTestTicketNumber(),
            lastActivityAt: new Date(),
          },
        });
      });
      await syncTicketSlaStateForTicket(tenantA, ticketId, {
        workspaceType: "denali",
        categoryCode: "general",
        priority: "normal",
        queueId: null,
        status: "open",
        createdAt: new Date().toISOString(),
        onHold: false,
        nowIso: new Date().toISOString(),
      });
      assert.ok(await getTicketSlaState(tenantA, ticketId));

      const operatorDetail = await requestJson(listener, {
        method: "GET",
        path: `/tickets/${ticketId}`,
        tenantId: tenantA,
        userId: adminA,
        role: "admin",
      });
      assert.equal(operatorDetail.status, 200, JSON.stringify(operatorDetail.body));
      assert.ok(operatorDetail.body.ticket);
      assert.ok(operatorDetail.body.sla, JSON.stringify(operatorDetail.body));

      const memberDetail = await requestJson(listener, {
        method: "GET",
        path: `/member/tickets/${ticketId}`,
        tenantId: tenantA,
        userId: memberA,
        role: "member",
      });
      assert.equal(memberDetail.status, 200);
      assert.equal(memberDetail.body.sla, undefined);
    });
  },
);
