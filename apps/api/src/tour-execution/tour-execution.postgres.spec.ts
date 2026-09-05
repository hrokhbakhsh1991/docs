/**
 * ITO-001 — tour execution Postgres integration (manifest, state, changes, notifications).
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../app";
import { resetBookingsRepositorySingletonForTests } from "../bookings/create-bookings-repository";
import { resetBookingsServiceCompositionForTests } from "../bookings/create-bookings-service";
import { resetLazyFinanceServiceForTests } from "../boot/lazy-finance-service";
import { resetLazyRouteHandlersForTests } from "../boot/lazy-route-handlers";
import { resetLazyWorkspaceFinanceHandlersForTests } from "../boot/lazy-workspace-finance-handlers";
import { disconnectPrisma } from "../db/prisma";
import { processOutboxRelayForTenantOnce } from "../outbox/outbox-relay";
import { listMemberNotifications } from "../notifications/member-notification.repository";
import { deleteTourExecutionForTests } from "../tour-execution/tour-execution.service";
import {
  parseTourExecutionManifestXlsx,
} from "../tour-execution/tour-execution-manifest-export.service";
import { integrationTenantId, preparePostgresOutboxIsolation } from "../../test/test-helpers";
import { installPostgresNotificationTestIsolation } from "../../test/postgres-notification-test-isolation";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const hasPrismaDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase() === "prisma";
const postgresSkip = !hasDatabase
  ? "ITO_REQUIRES_DATABASE"
  : !hasPrismaDriver
    ? "ITO_REQUIRES_STORAGE_DRIVER=prisma"
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
    "x-workspace-id": "ws-ito-001",
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
            ...authHeaders(input),
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

async function requestBuffer(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly tenantId: string;
    readonly userId: string;
    readonly role?: "admin" | "owner" | "member" | "viewer";
  },
): Promise<{ status: number; buffer: Buffer; headers: http.IncomingHttpHeaders }> {
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
          headers: authHeaders(input),
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            server.close();
            resolve({
              status: res.statusCode ?? 0,
              buffer: Buffer.concat(chunks),
              headers: res.headers,
            });
          });
        },
      );
      req.on("error", (error) => {
        server.close();
        reject(error);
      });
      req.end();
    });
  });
}

describe("tour-execution.postgres.spec.ts — ITO-001", { skip: postgresSkip, concurrency: false }, () => {
  const tenantA = integrationTenantId();
  const operatorId = randomUUID();
  const leaderUserId = randomUUID();
  const memberId = randomUUID();
  const tourId = randomUUID();
  let bookingId = "";
  const admin = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL_ADMIN } },
  });
  const listener = createRequestListener();

  before(async () => {
    process.env.STORAGE_DRIVER = "prisma";
    process.env.NODE_ENV = "test";
    await preparePostgresOutboxIsolation(admin, tenantA);
    installPostgresNotificationTestIsolation(tenantA);
    await admin.tenant.upsert({
      where: { id: tenantA },
      create: {
        id: tenantA,
        subdomain: `ito-${tenantA.slice(0, 8)}`,
        workspaceType: "denali",
      },
      update: {},
    });
    await admin.tour.upsert({
      where: { tenantId_id: { tenantId: tenantA, id: tourId } },
      create: {
        id: tourId,
        tenantId: tenantA,
        canonical: {},
        title: "ITO Test Tour",
        publishStatus: "published",
        startDate: new Date("2026-09-10"),
      },
      update: {},
    });
    for (const seed of [
      { userId: operatorId, mobile: `+1555ito-op-${operatorId.slice(0, 8)}`, displayName: "ITO Operator" },
      { userId: leaderUserId, mobile: `+1555ito-ld-${leaderUserId.slice(0, 8)}`, displayName: "ITO Leader" },
    ] as const) {
      await admin.user.upsert({
        where: { id: seed.userId },
        create: { id: seed.userId, mobile: seed.mobile },
        update: {},
      });
      await admin.userTenant.upsert({
        where: { userId_tenantId: { userId: seed.userId, tenantId: tenantA } },
        create: {
          userId: seed.userId,
          tenantId: tenantA,
          role: "admin",
          status: "ACTIVE",
          membershipMetadata: { displayName: seed.displayName },
        },
        update: {
          role: "admin",
          status: "ACTIVE",
          membershipMetadata: { displayName: seed.displayName },
        },
      });
    }
  });

  beforeEach(async () => {
    resetBookingsRepositorySingletonForTests();
    resetBookingsServiceCompositionForTests();
    resetLazyFinanceServiceForTests();
    resetLazyRouteHandlersForTests();
    resetLazyWorkspaceFinanceHandlersForTests();
    await deleteTourExecutionForTests(tenantA, tourId);
    await admin.operatorRegistration.deleteMany({ where: { tenantId: tenantA, tourId } });
    await admin.outboxEvent.deleteMany({ where: { tenantId: tenantA } });
    await admin.memberNotification.deleteMany({ where: { tenantId: tenantA } });

    const createRes = await requestJson(listener, {
      method: "POST",
      path: "/bookings",
      tenantId: tenantA,
      userId: operatorId,
      body: {
        tourId,
        tourTitle: "ITO Test Tour",
        guestLabel: `Guest-${Date.now()}`,
        partySize: 1,
        departureAt: new Date("2026-09-10T08:00:00.000Z").toISOString(),
        registrationIntake: { insuranceStatus: "confirmed", tourCapacityMax: 20 },
      },
    });
    assert.equal(createRes.status, 201);
    bookingId = String(createRes.body.id);
    const approveRes = await requestJson(listener, {
      method: "POST",
      path: `/bookings/${bookingId}/approve`,
      tenantId: tenantA,
      userId: operatorId,
    });
    assert.equal(approveRes.status, 200);
  });

  after(async () => {
    await deleteTourExecutionForTests(tenantA, tourId);
    await disconnectPrisma();
    await admin.$disconnect();
  });

  it("ITO-P01 bootstrap execution draft + default checklist", async () => {
    const res = await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.state, "draft");
    const checklist = res.body.checklist as unknown[];
    assert.ok(Array.isArray(checklist) && checklist.length >= 3);
  });

  it("ITO-P02 lock manifest snapshots approved registration", async () => {
    await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    const lock = await requestJson(listener, {
      method: "POST",
      path: `/tours/${tourId}/execution/manifest/lock`,
      tenantId: tenantA,
      userId: operatorId,
    });
    assert.equal(lock.status, 200);
    assert.equal(lock.body.state, "manifest_locked");
    const manifest = lock.body.manifest as Array<Record<string, unknown>>;
    assert.equal(manifest.length, 1);
    assert.equal(manifest[0]?.registrationId, bookingId);
    assert.equal(manifest[0]?.insuranceStatus, "confirmed");
  });

  it("ITO-P03 viewer forbidden to lock manifest", async () => {
    const lock = await requestJson(listener, {
      method: "POST",
      path: `/tours/${tourId}/execution/manifest/lock`,
      tenantId: tenantA,
      userId: operatorId,
      role: "viewer",
    });
    assert.equal(lock.status, 403);
  });

  it("ITO-P04 state transition to in_progress emits outbox + member notification", async () => {
    await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    const lock = await requestJson(listener, {
      method: "POST",
      path: `/tours/${tourId}/execution/manifest/lock`,
      tenantId: tenantA,
      userId: operatorId,
    });
    assert.equal(lock.status, 200);
    let current = await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    let preTour = await requestJson(listener, {
      method: "PATCH",
      path: `/tours/${tourId}/execution/state`,
      tenantId: tenantA,
      userId: operatorId,
      body: { targetState: "pre_tour", expectedVersion: current.body.rowVersion },
    });
    assert.equal(preTour.status, 200, JSON.stringify(preTour.body));
    current = await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    const start = await requestJson(listener, {
      method: "PATCH",
      path: `/tours/${tourId}/execution/state`,
      tenantId: tenantA,
      userId: operatorId,
      body: { targetState: "in_progress", expectedVersion: current.body.rowVersion },
    });
    assert.equal(start.status, 200);
    assert.equal(start.body.state, "in_progress");

    await processOutboxRelayForTenantOnce(tenantA);
    const inbox = await listMemberNotifications({ tenantId: tenantA, userId: operatorId, limit: 50 });
    const match = inbox.items.find((item) => item.eventType === "tour.execution.started");
    assert.ok(match, "tour.execution.started must reach member inbox");
  });

  it("ITO-P05 schedule change notifies members once", async () => {
    await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    await requestJson(listener, {
      method: "POST",
      path: `/tours/${tourId}/execution/manifest/lock`,
      tenantId: tenantA,
      userId: operatorId,
    });
    const nextAt = new Date("2026-09-10T09:30:00.000Z").toISOString();
    const patch = await requestJson(listener, {
      method: "PATCH",
      path: `/tours/${tourId}/execution/schedule`,
      tenantId: tenantA,
      userId: operatorId,
      body: { scheduledMeetingAt: nextAt, idempotencyKey: "ito-schedule-1" },
    });
    assert.equal(patch.status, 200);
    await processOutboxRelayForTenantOnce(tenantA);
    const inbox = await listMemberNotifications({ tenantId: tenantA, userId: operatorId, limit: 50 });
    const rows = inbox.items.filter((item) => item.eventType === "tour.execution.change.notified");
    assert.equal(rows.length, 1);
  });

  it("ITO-P06 member execution summary for approved registration", async () => {
    await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    await requestJson(listener, {
      method: "POST",
      path: `/tours/${tourId}/execution/manifest/lock`,
      tenantId: tenantA,
      userId: operatorId,
    });
    const summary = await requestJson(listener, {
      method: "GET",
      path: `/member/tours/${tourId}/execution-summary`,
      tenantId: tenantA,
      userId: operatorId,
      role: "member",
    });
    assert.equal(summary.status, 200);
    assert.equal(summary.body.registrationId, bookingId);
    assert.equal(summary.body.state, "manifest_locked");
  });

  it("ITO-P07 cross-tenant execution read denied", async () => {
    const tenantB = integrationTenantId();
    const res = await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantB,
      userId: operatorId,
    });
    assert.equal(res.status, 404);
  });

  it("ITO-P08 replace groups and assign manifest row", async () => {
    await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    await requestJson(listener, {
      method: "POST",
      path: `/tours/${tourId}/execution/manifest/lock`,
      tenantId: tenantA,
      userId: operatorId,
    });
    const groups = await requestJson(listener, {
      method: "PUT",
      path: `/tours/${tourId}/execution/groups`,
      tenantId: tenantA,
      userId: operatorId,
      body: { groups: [{ name: "Group A", leaderUserId: null }] },
    });
    assert.equal(groups.status, 200);
    const groupId = (groups.body.groups as Array<{ id: string }>)[0]?.id;
    assert.ok(groupId);
    const assign = await requestJson(listener, {
      method: "PATCH",
      path: `/tours/${tourId}/execution/manifest/${bookingId}/group`,
      tenantId: tenantA,
      userId: operatorId,
      body: { groupId },
    });
    assert.equal(assign.status, 200);
  });

  it("ITO-P09 checklist toggle idempotent", async () => {
    await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    const current = await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    const itemId = (current.body.checklist as Array<{ id: string }>)[0]?.id;
    assert.ok(itemId);
    const first = await requestJson(listener, {
      method: "PATCH",
      path: `/tours/${tourId}/execution/checklist/${itemId}`,
      tenantId: tenantA,
      userId: operatorId,
      body: { completed: true },
    });
    assert.equal(first.status, 200);
    const second = await requestJson(listener, {
      method: "PATCH",
      path: `/tours/${tourId}/execution/checklist/${itemId}`,
      tenantId: tenantA,
      userId: operatorId,
      body: { completed: true },
    });
    assert.equal(second.status, 200);
  });

  it("ITO-P10 operational event persisted", async () => {
    await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    const event = await requestJson(listener, {
      method: "POST",
      path: `/tours/${tourId}/execution/operational-events`,
      tenantId: tenantA,
      userId: operatorId,
      body: {
        eventKind: "delay",
        severity: "warning",
        description: "Bus delayed 15 minutes",
      },
    });
    assert.equal(event.status, 200);
    const events = event.body.operationalEvents as Array<{ description: string }>;
    assert.ok(events.some((row) => row.description.includes("Bus delayed")));
  });

  it("ITO-P11 assign and unset tour leader with audit log", async () => {
    await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    const assign = await requestJson(listener, {
      method: "PATCH",
      path: `/tours/${tourId}/execution/tour-leader`,
      tenantId: tenantA,
      userId: operatorId,
      body: { tourLeaderUserId: leaderUserId },
    });
    assert.equal(assign.status, 200);
    assert.equal(assign.body.tourLeaderUserId, leaderUserId);
    assert.equal(assign.body.tourLeaderDisplayName, "ITO Leader");

    const logs = await admin.tourExecutionChangeLog.findMany({
      where: { tenantId: tenantA, changeType: "tour_leader" },
    });
    assert.ok(logs.length >= 1);

    const unset = await requestJson(listener, {
      method: "PATCH",
      path: `/tours/${tourId}/execution/tour-leader`,
      tenantId: tenantA,
      userId: operatorId,
      body: { tourLeaderUserId: null },
    });
    assert.equal(unset.status, 200);
    assert.equal(unset.body.tourLeaderUserId, null);
  });

  it("ITO-P12 rejects invalid tour leader and viewer mutation", async () => {
    await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    const invalid = await requestJson(listener, {
      method: "PATCH",
      path: `/tours/${tourId}/execution/tour-leader`,
      tenantId: tenantA,
      userId: operatorId,
      body: { tourLeaderUserId: randomUUID() },
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, "TOUR_EXECUTION_INVALID_LEADER");

    const viewer = await requestJson(listener, {
      method: "PATCH",
      path: `/tours/${tourId}/execution/tour-leader`,
      tenantId: tenantA,
      userId: operatorId,
      role: "viewer",
      body: { tourLeaderUserId: leaderUserId },
    });
    assert.equal(viewer.status, 403);
  });

  it("ITO-P13 member summary exposes public tour leader name", async () => {
    await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    await requestJson(listener, {
      method: "POST",
      path: `/tours/${tourId}/execution/manifest/lock`,
      tenantId: tenantA,
      userId: operatorId,
    });
    await requestJson(listener, {
      method: "PATCH",
      path: `/tours/${tourId}/execution/tour-leader`,
      tenantId: tenantA,
      userId: operatorId,
      body: { tourLeaderUserId: leaderUserId },
    });
    const summary = await requestJson(listener, {
      method: "GET",
      path: `/member/tours/${tourId}/execution-summary`,
      tenantId: tenantA,
      userId: operatorId,
      role: "member",
    });
    assert.equal(summary.status, 200);
    assert.equal(summary.body.tourLeaderDisplayName, "ITO Leader");
  });

  it("ITO-P14 exports locked manifest xlsx and parses rows", async () => {
    await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    await requestJson(listener, {
      method: "POST",
      path: `/tours/${tourId}/execution/manifest/lock`,
      tenantId: tenantA,
      userId: operatorId,
    });
    const exported = await requestBuffer(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution/manifest/export?locale=en`,
      tenantId: tenantA,
      userId: operatorId,
    });
    assert.equal(exported.status, 200);
    assert.match(String(exported.headers["content-type"] ?? ""), /spreadsheetml/);
    const rows = parseTourExecutionManifestXlsx(exported.buffer);
    assert.ok(rows.length >= 1);
    assert.ok(Object.keys(rows[0] ?? {}).includes("Guest"));
    assert.ok(String(rows[0]?.Guest ?? "").startsWith("Guest-"));
  });

  it("ITO-P15 export forbidden before manifest lock and for viewer", async () => {
    await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution`,
      tenantId: tenantA,
      userId: operatorId,
    });
    const draftExport = await requestBuffer(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution/manifest/export`,
      tenantId: tenantA,
      userId: operatorId,
    });
    assert.equal(draftExport.status, 409);

    await requestJson(listener, {
      method: "POST",
      path: `/tours/${tourId}/execution/manifest/lock`,
      tenantId: tenantA,
      userId: operatorId,
    });
    const viewerExport = await requestBuffer(listener, {
      method: "GET",
      path: `/tours/${tourId}/execution/manifest/export`,
      tenantId: tenantA,
      userId: operatorId,
      role: "viewer",
    });
    assert.equal(viewerExport.status, 403);
  });
});
