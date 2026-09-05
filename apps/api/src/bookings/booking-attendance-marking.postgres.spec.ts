/**
 * SDE-001 attendance producer — real HTTP → Prisma → outbox → relay → member_notifications.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../app";
import {
  getBookingsRepository,
  resetBookingsRepositorySingletonForTests,
} from "../bookings/create-bookings-repository";
import { resetBookingsServiceCompositionForTests } from "../bookings/create-bookings-service";
import { PrismaBookingsRepository } from "../bookings/prisma-bookings.repository";
import { resetLazyFinanceServiceForTests } from "../boot/lazy-finance-service";
import { resetLazyRouteHandlersForTests } from "../boot/lazy-route-handlers";
import { resetLazyWorkspaceFinanceHandlersForTests } from "../boot/lazy-workspace-finance-handlers";
import { disconnectPrisma } from "../db/prisma";
import { processOutboxRelayForTenantOnce } from "../outbox/outbox-relay";
import { listMemberNotifications } from "../notifications/member-notification.repository";
import { integrationTenantId, preparePostgresOutboxIsolation } from "../../test/test-helpers";
import { installPostgresNotificationTestIsolation } from "../../test/postgres-notification-test-isolation";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const hasPrismaDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase() === "prisma";
const postgresSkip = !hasDatabase
  ? "ATTENDANCE_REQUIRES_DATABASE"
  : !hasPrismaDriver
    ? "ATTENDANCE_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

function authHeaders(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly role?: "admin" | "owner" | "member";
}): Record<string, string> {
  return {
    "x-tenant-id": input.tenantId,
    "x-authenticated-tenant-id": input.tenantId,
    "x-user-id": input.userId,
    "x-actor-role": input.role ?? "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-attendance-producer",
  };
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly tenantId: string;
    readonly userId: string;
    readonly role?: "admin" | "owner" | "member";
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

describe(
  "booking-attendance-marking.postgres.spec.ts",
  { skip: postgresSkip, concurrency: false },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const operatorId = randomUUID();
    const memberUser = randomUUID();
    const tourId = randomUUID();
    const listener = createRequestListener();
    let admin: PrismaClient;
    const priorDriver = process.env.STORAGE_DRIVER;

    installPostgresNotificationTestIsolation();

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.OUTBOX_RELAY_ENABLED = "false";
      process.env.PROJECTION_AUTO_RECONCILE_ENABLED = "false";
      process.env.PAYMENT_HOLD_ENABLED = "true";
      await preparePostgresOutboxIsolation();
      resetLazyRouteHandlersForTests();
      resetLazyFinanceServiceForTests();
      resetLazyWorkspaceFinanceHandlersForTests();
      resetBookingsRepositorySingletonForTests();
      resetBookingsServiceCompositionForTests();
      admin = new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL_ADMIN!.trim() } },
      });
      await admin.$executeRawUnsafe(`
        ALTER TABLE operator_registrations
          ADD COLUMN IF NOT EXISTS attendance_status TEXT,
          ADD COLUMN IF NOT EXISTS attendance_marked_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS attendance_marked_by_user_id UUID
      `);
      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `att-a-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
            theme: { enabledModules: ["ticketing", "wallet", "engagement", "finance"] },
          },
          {
            id: tenantB,
            subdomain: `att-b-${tenantB.slice(0, 8)}`,
            workspaceType: "denali",
            theme: {},
          },
        ],
      });
      await admin.user.createMany({
        data: [
          { id: operatorId, mobile: `+98912${operatorId.replace(/-/g, "").slice(0, 8)}` },
          { id: memberUser, mobile: `+98913${memberUser.replace(/-/g, "").slice(0, 8)}` },
        ],
      });
      await admin.userTenant.createMany({
        data: [
          { tenantId: tenantA, userId: operatorId, role: "admin", status: "ACTIVE" },
          { tenantId: tenantA, userId: memberUser, role: "member", status: "ACTIVE" },
        ],
      });
      await admin.tour.create({
        data: {
          id: tourId,
          tenantId: tenantA,
          title: "Attendance Producer Tour",
          publishStatus: "published",
          canonical: {
            schemaVersion: 1,
            roots: ["pricing"],
            data: {
              title: "Attendance Producer Tour",
              publishStatus: "published",
              capacityMax: 20,
              pricing: {
                basePricePerPerson: 2_500_000,
                paymentMode: "offline_receipt",
                paymentCollection: "offline",
              },
            },
          },
        },
      });
      assert.ok(getBookingsRepository() instanceof PrismaBookingsRepository);
    });

    beforeEach(async () => {
      resetBookingsServiceCompositionForTests();
      resetLazyFinanceServiceForTests();
      await admin.memberNotification.deleteMany({ where: { tenantId: tenantA } });
      await admin.outboxEvent.deleteMany({ where: { tenantId: tenantA } });
      await admin.operatorRegistration.deleteMany({ where: { tenantId: tenantA } });
      await admin.$executeRawUnsafe(
        "ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only",
      );
      try {
        await admin.auditEvent.deleteMany({ where: { tenantId: tenantA } });
      } finally {
        await admin.$executeRawUnsafe(
          "ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only",
        );
      }
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      try {
        await admin.memberNotification.deleteMany({ where: { tenantId: tenantA } });
        await admin.outboxEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.operatorRegistration.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
        await admin.tour.deleteMany({ where: { id: tourId } });
        await admin.userTenant.deleteMany({
          where: { tenantId: tenantA, userId: { in: [operatorId, memberUser] } },
        });
        await admin.user.deleteMany({ where: { id: { in: [operatorId, memberUser] } } });
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
        await admin.$executeRawUnsafe(
          "ALTER TABLE engagement_point_events DISABLE TRIGGER engagement_point_events_append_only",
        );
        try {
          await admin.engagementPointEvent.deleteMany({ where: { tenantId: tenantA } });
          await admin.memberEngagementBadge.deleteMany({ where: { tenantId: tenantA } });
          await admin.engagementProfile.deleteMany({ where: { tenantId: tenantA } });
        } finally {
          await admin.$executeRawUnsafe(
            "ALTER TABLE engagement_point_events ENABLE TRIGGER engagement_point_events_append_only",
          );
        }
        await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      } finally {
        await admin.$disconnect();
        await disconnectPrisma();
      }
    });

    function createBody(input: {
      readonly guestLabel: string;
      readonly memberUserId?: string;
      readonly submitterUserId?: string;
    }): Record<string, unknown> {
      return {
        tourId,
        tourTitle: "Attendance Producer Tour",
        guestLabel: input.guestLabel,
        partySize: 1,
        departureAt: new Date(Date.now() + 86_400_000).toISOString(),
        registrationIntake: { tourCapacityMax: 20 },
        ...(input.memberUserId !== undefined ? { memberUserId: input.memberUserId } : {}),
      };
    }

    async function createAndApproveBooking(input?: {
      readonly guestLabel?: string;
      readonly memberUserId?: string;
    }): Promise<string> {
      const submitterUserId = randomUUID();
      await admin.user.create({
        data: {
          id: submitterUserId,
          mobile: `+98914${submitterUserId.replace(/-/g, "").slice(0, 8)}`,
        },
      });
      await admin.userTenant.create({
        data: { tenantId: tenantA, userId: submitterUserId, role: "admin", status: "ACTIVE" },
      });

      const create = await requestJson(listener, {
        method: "POST",
        path: "/bookings",
        tenantId: tenantA,
        userId: submitterUserId,
        body: createBody({
          guestLabel: input?.guestLabel ?? `Guest ${randomUUID().slice(0, 8)}`,
          memberUserId: input?.memberUserId,
        }),
      });
      assert.equal(create.status, 201, JSON.stringify(create.body));
      const bookingId = String(create.body.id);
      const approve = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${bookingId}/approve`,
        tenantId: tenantA,
        userId: submitterUserId,
      });
      assert.equal(approve.status, 200, JSON.stringify(approve.body));
      return bookingId;
    }

    it("ATT-01 present on approved → durable outbox attendance.marked + audit", async () => {
      const bookingId = await createAndApproveBooking();
      const mark = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${bookingId}/attendance`,
        tenantId: tenantA,
        userId: operatorId,
        body: { attendanceStatus: "present" },
      });
      assert.equal(mark.status, 200);
      assert.equal(mark.body.attendanceStatus, "present");
      assert.equal(mark.body.idempotentReplay, false);

      const row = await admin.operatorRegistration.findFirst({ where: { id: bookingId } });
      assert.equal(row?.attendanceStatus, "present");
      assert.ok(row?.attendanceMarkedAt);
      assert.equal(row?.attendanceMarkedByUserId, operatorId);

      const outbox = await admin.outboxEvent.findMany({
        where: { tenantId: tenantA, aggregateId: bookingId, eventType: "attendance.marked" },
      });
      assert.equal(outbox.length, 1);
      assert.equal(outbox[0]?.status, "pending");

      const audit = await admin.auditEvent.findMany({
        where: { tenantId: tenantA, entityId: bookingId, action: "BOOKING_ATTENDANCE_MARKED" },
      });
      assert.equal(audit.length, 1);
    });

    it("ATT-02 relay → member notification inbox", async () => {
      const bookingId = await createAndApproveBooking({ memberUserId: memberUser });
      await requestJson(listener, {
        method: "POST",
        path: `/bookings/${bookingId}/attendance`,
        tenantId: tenantA,
        userId: operatorId,
        body: { attendanceStatus: "absent" },
      });
      const pending = await admin.outboxEvent.findMany({
        where: { tenantId: tenantA, eventType: "attendance.marked", status: "pending" },
      });
      assert.ok(
        pending.some((row) => row.aggregateId === bookingId),
        "attendance.marked outbox row must exist before relay",
      );
      const relay = await processOutboxRelayForTenantOnce(tenantA, 20);
      assert.ok(relay.published >= 1, JSON.stringify(relay));
      const list = await listMemberNotifications({
        tenantId: tenantA,
        userId: memberUser,
        sourceModule: "booking",
        limit: 20,
      });
      const match = list.items.find(
        (item) => item.eventType === "attendance.marked" && item.entityId === bookingId,
      );
      assert.ok(match, "attendance.marked must fan out to member inbox");
    });

    it("ATT-03 idempotent replay same status — no duplicate outbox", async () => {
      const bookingId = await createAndApproveBooking();
      const first = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${bookingId}/attendance`,
        tenantId: tenantA,
        userId: operatorId,
        body: { attendanceStatus: "present" },
      });
      assert.equal(first.status, 200);
      const second = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${bookingId}/attendance`,
        tenantId: tenantA,
        userId: operatorId,
        body: { attendanceStatus: "present" },
      });
      assert.equal(second.status, 200);
      assert.equal(second.body.idempotentReplay, true);
      const outbox = await admin.outboxEvent.findMany({
        where: { tenantId: tenantA, aggregateId: bookingId, eventType: "attendance.marked" },
      });
      assert.equal(outbox.length, 1);
    });

    it("ATT-04 conflict when changing attendance status", async () => {
      const bookingId = await createAndApproveBooking();
      await requestJson(listener, {
        method: "POST",
        path: `/bookings/${bookingId}/attendance`,
        tenantId: tenantA,
        userId: operatorId,
        body: { attendanceStatus: "present" },
      });
      const conflict = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${bookingId}/attendance`,
        tenantId: tenantA,
        userId: operatorId,
        body: { attendanceStatus: "absent" },
      });
      assert.equal(conflict.status, 409);
      assert.match(String(conflict.body.code ?? ""), /BOOKING_ATTENDANCE_CONFLICT/);
    });

    it("ATT-05 pending registration rejected", async () => {
      const submitterUserId = randomUUID();
      await admin.user.create({
        data: {
          id: submitterUserId,
          mobile: `+98915${submitterUserId.replace(/-/g, "").slice(0, 8)}`,
        },
      });
      await admin.userTenant.create({
        data: { tenantId: tenantA, userId: submitterUserId, role: "admin", status: "ACTIVE" },
      });
      const create = await requestJson(listener, {
        method: "POST",
        path: "/bookings",
        tenantId: tenantA,
        userId: submitterUserId,
        body: createBody({ guestLabel: "Pending Guest" }),
      });
      assert.equal(create.status, 201, JSON.stringify(create.body));
      const bookingId = String(create.body.id);
      const mark = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${bookingId}/attendance`,
        tenantId: tenantA,
        userId: operatorId,
        body: { attendanceStatus: "present" },
      });
      assert.equal(mark.status, 409);
      assert.match(String(mark.body.code ?? ""), /BOOKING_ATTENDANCE_INVALID_STATUS/);
    });

    it("ATT-06 member role forbidden", async () => {
      const bookingId = await createAndApproveBooking();
      const mark = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${bookingId}/attendance`,
        tenantId: tenantA,
        userId: memberUser,
        role: "member",
        body: { attendanceStatus: "present" },
      });
      assert.equal(mark.status, 403);
    });

    it("ATT-07 cross-tenant booking not found", async () => {
      const bookingId = await createAndApproveBooking();
      const mark = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${bookingId}/attendance`,
        tenantId: tenantB,
        userId: operatorId,
        body: { attendanceStatus: "present" },
      });
      assert.equal(mark.status, 404);
    });

    it("ATT-08 invalid body", async () => {
      const bookingId = await createAndApproveBooking();
      const mark = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${bookingId}/attendance`,
        tenantId: tenantA,
        userId: operatorId,
        body: { attendanceStatus: "maybe" },
      });
      assert.equal(mark.status, 400);
      assert.match(String(mark.body.code ?? ""), /BOOKING_ATTENDANCE_INVALID/);
    });
  },
);
