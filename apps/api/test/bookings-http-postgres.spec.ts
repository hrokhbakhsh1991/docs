/**
 * Booking HTTP → PostgreSQL certification matrix (production API path only).
 *
 * Path: HTTP → route → facade → resolveBookingsServiceForTenant → BookingsService
 *       → PrismaBookingsRepository → PostgreSQL + RLS
 *
 * Forbidden: InMemoryBookingsRepository, mocked repositories, direct service calls.
 *
 * @see docs/phase-20/p7/appendices/BOOKING_HTTP_POSTGRES_CERT.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../src/app";
import {
  getBookingsRepository,
  resetBookingsRepositorySingletonForTests,
} from "../src/bookings/create-bookings-repository";
import { resetBookingsServiceCompositionForTests } from "../src/bookings/create-bookings-service";
import { PrismaBookingsRepository } from "../src/bookings/prisma-bookings.repository";
import { resetLazyFinanceServiceForTests } from "../src/boot/lazy-finance-service";
import { resetLazyRouteHandlersForTests } from "../src/boot/lazy-route-handlers";
import { resetLazyWorkspaceFinanceHandlersForTests } from "../src/boot/lazy-workspace-finance-handlers";
import { disconnectPrisma } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { integrationTenantId } from "./test-helpers";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

// MR-P0-015: dedicated PG certification suite must never silently skip green.
if (!hasDatabase) {
  throw new Error(
    "BOOKING_HTTP_POSTGRES_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN (MR-P0-015)"
  );
}

function resolveAdminUrl(): string {
  const adminUrl = process.env.DATABASE_URL_ADMIN?.trim();
  if (!adminUrl) {
    throw new Error("BOOKING_HTTP_POSTGRES_REQUIRES_DATABASE_URL_ADMIN");
  }
  return adminUrl;
}

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
    "x-workspace-id": "ws-booking-http-pg",
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
  }
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
        }
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
  "bookings-http-postgres.spec.ts — Booking HTTP PostgreSQL certification matrix",
  { concurrency: false },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const tourId = randomUUID();
    const operatorA = randomUUID();
    const operatorB = randomUUID();
    let admin: PrismaClient;
    const listener = createRequestListener();

    before(async () => {
      assert.equal(
        process.env.STORAGE_DRIVER?.trim().toLowerCase(),
        "prisma",
        "BOOKING_HTTP_POSTGRES_FORBIDS_MEMORY: STORAGE_DRIVER must be prisma"
      );
      process.env.STORAGE_DRIVER = "prisma";
      process.env.OUTBOX_RELAY_ENABLED = "false";
      process.env.PROJECTION_AUTO_RECONCILE_ENABLED = "false";

      resetLazyRouteHandlersForTests();
      resetLazyFinanceServiceForTests();
      resetLazyWorkspaceFinanceHandlersForTests();
      resetBookingsRepositorySingletonForTests();
      resetBookingsServiceCompositionForTests();

      admin = new PrismaClient({ datasources: { db: { url: resolveAdminUrl() } } });
      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `bk-a-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
            theme: {},
          },
          {
            id: tenantB,
            subdomain: `bk-b-${tenantB.slice(0, 8)}`,
            workspaceType: "denali",
            theme: {},
          },
        ],
      });

      const repo = getBookingsRepository();
      assert.ok(
        repo instanceof PrismaBookingsRepository,
        "BOOKING_HTTP_POSTGRES_FORBIDS_MEMORY: expected PrismaBookingsRepository"
      );
    });

    beforeEach(() => {
      resetBookingsServiceCompositionForTests();
      resetLazyFinanceServiceForTests();
    });

    after(async () => {
      try {
        for (const tenantId of [tenantA, tenantB]) {
          await admin.paymentReceipt.deleteMany({ where: { tenantId } });
          await admin.payment.deleteMany({ where: { tenantId } });
          await admin.outboxEvent.deleteMany({ where: { tenantId } });
          await admin.operatorRegistration.deleteMany({ where: { tenantId } });
        }
        await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      } finally {
        await admin.$disconnect();
        await disconnectPrisma();
        resetBookingsRepositorySingletonForTests();
        resetBookingsServiceCompositionForTests();
      }
    });

    function createBody(input: {
      readonly guestLabel: string;
      readonly partySize?: number;
      readonly tourCapacityMax?: number;
      readonly tourId?: string;
    }): Record<string, unknown> {
      return {
        tourId: input.tourId ?? tourId,
        tourTitle: "HTTP Postgres Cert Tour",
        guestLabel: input.guestLabel,
        partySize: input.partySize ?? 1,
        departureAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        registrationIntake: { tourCapacityMax: input.tourCapacityMax ?? 20 },
      };
    }

    async function httpCreate(
      tenantId: string,
      userId: string,
      body: Record<string, unknown>
    ): Promise<{ status: number; body: Record<string, unknown> }> {
      return requestJson(listener, {
        method: "POST",
        path: "/bookings",
        tenantId,
        userId,
        body,
      });
    }

    async function createPending(input: {
      readonly guestLabel: string;
      readonly partySize?: number;
      readonly tourCapacityMax?: number;
      readonly tourId?: string;
      readonly tenantId?: string;
      readonly userId?: string;
    }): Promise<string> {
      const tenantId = input.tenantId ?? tenantA;
      const userId = input.userId ?? operatorA;
      const response = await httpCreate(tenantId, userId, createBody(input));
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.equal(response.body.status, "pending");
      assert.equal(typeof response.body.id, "string");
      return response.body.id as string;
    }

    // ─── 1. POST /bookings ───────────────────────────────────────────────

    it("C1 POST /bookings valid create → 201 + Prisma row", async () => {
      const response = await httpCreate(
        tenantA,
        operatorA,
        createBody({ guestLabel: "C1 Guest" })
      );
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.equal(typeof response.body.id, "string");
      assert.equal(response.body.status, "pending");
      assert.equal(Object.keys(response.body).sort().join(","), "id,status");

      const row = await admin.operatorRegistration.findUnique({
        where: { id: response.body.id as string },
      });
      assert.ok(row !== null);
      assert.equal(row?.tenantId, tenantA);
      assert.equal(row?.status, "pending");
      assert.equal(row?.guestLabel, "C1 Guest");
    });

    it("C2 POST /bookings validation failure → 400 BOOKING_CREATE_INVALID", async () => {
      const before = await admin.operatorRegistration.count({ where: { tenantId: tenantA } });
      const response = await httpCreate(tenantA, operatorA, {
        tourId,
        tourTitle: "Trip",
        guestLabel: "",
        partySize: 2,
        departureAt: new Date(Date.now() + 86400000).toISOString(),
      });
      assert.equal(response.status, 400, JSON.stringify(response.body));
      assert.equal(response.body.code, "BOOKING_CREATE_INVALID");
      assert.equal(response.body.error, "invalid_body");
      const after = await admin.operatorRegistration.count({ where: { tenantId: tenantA } });
      assert.equal(after, before);
    });

    it("C3 POST /bookings capacity failure → 409 BOOKING_CAPACITY_REJECTED", async () => {
      const before = await admin.operatorRegistration.count({ where: { tenantId: tenantA } });
      const response = await httpCreate(
        tenantA,
        operatorA,
        createBody({ guestLabel: "C3 Over", partySize: 5, tourCapacityMax: 2 })
      );
      assert.equal(response.status, 409, JSON.stringify(response.body));
      assert.equal(response.body.code, "BOOKING_CAPACITY_REJECTED");
      assert.match(String(response.body.error ?? ""), /BOOKING_CAPACITY_REJECTED/);
      const after = await admin.operatorRegistration.count({ where: { tenantId: tenantA } });
      assert.equal(after, before);
    });

    // ─── 2. POST /bookings/:id/approve ───────────────────────────────────

    it("A1 POST /bookings/:id/approve success → 200 + outbox", async () => {
      const id = await createPending({ guestLabel: "A1 Guest" });
      const response = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${id}/approve`,
        tenantId: tenantA,
        userId: operatorA,
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.status, "approved");
      assert.equal(typeof response.body.approvedAt, "string");

      const row = await admin.operatorRegistration.findUnique({ where: { id } });
      assert.equal(row?.status, "approved");
      assert.ok(row?.approvedAt !== null);

      const outbox = await admin.outboxEvent.findMany({
        where: { tenantId: tenantA, aggregateId: id, eventType: "registration.approved" },
      });
      assert.equal(outbox.length, 1);
      assert.equal(outbox[0]?.aggregateType, "registration");
    });

    it("A2 POST /bookings/:id/approve capacity conflict → 409", async () => {
      // Soft create gate allows pending pile-up while approved=0; approve serializes winners.
      const lockedTour = randomUUID();
      const first = await createPending({
        guestLabel: "A2 Winner",
        partySize: 1,
        tourCapacityMax: 1,
        tourId: lockedTour,
      });
      const second = await createPending({
        guestLabel: "A2 Loser",
        partySize: 1,
        tourCapacityMax: 1,
        tourId: lockedTour,
      });
      const approveFirst = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${first}/approve`,
        tenantId: tenantA,
        userId: operatorA,
      });
      assert.equal(approveFirst.status, 200, JSON.stringify(approveFirst.body));

      const response = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${second}/approve`,
        tenantId: tenantA,
        userId: operatorA,
      });
      assert.equal(response.status, 409, JSON.stringify(response.body));
      assert.equal(response.body.code, "BOOKING_CAPACITY_REJECTED");

      const row = await admin.operatorRegistration.findUnique({ where: { id: second } });
      assert.equal(row?.status, "pending");
      const outbox = await admin.outboxEvent.count({
        where: { tenantId: tenantA, aggregateId: second, eventType: "registration.approved" },
      });
      assert.equal(outbox, 0);
    });

    it("A3 POST /bookings/:id/approve already approved → 409 BOOKING_ALREADY_APPROVED", async () => {
      const id = await createPending({ guestLabel: "A3 Guest" });
      const first = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${id}/approve`,
        tenantId: tenantA,
        userId: operatorA,
      });
      assert.equal(first.status, 200, JSON.stringify(first.body));

      const second = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${id}/approve`,
        tenantId: tenantA,
        userId: operatorA,
      });
      assert.equal(second.status, 409, JSON.stringify(second.body));
      assert.equal(second.body.code, "BOOKING_ALREADY_APPROVED");

      const outbox = await admin.outboxEvent.count({
        where: { tenantId: tenantA, aggregateId: id, eventType: "registration.approved" },
      });
      assert.equal(outbox, 1);
    });

    // ─── 3. POST /bookings/:id/reject ────────────────────────────────────

    it("R1 POST /bookings/:id/reject with reason → persist reject_reason", async () => {
      const id = await createPending({ guestLabel: "R1 Guest" });
      const response = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${id}/reject`,
        tenantId: tenantA,
        userId: operatorA,
        body: { reason: "docs incomplete" },
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.status, "rejected");
      assert.equal(response.body.rejectReason, "docs incomplete");

      const row = await admin.operatorRegistration.findUnique({ where: { id } });
      assert.equal(row?.status, "rejected");
      assert.equal(row?.rejectReason, "docs incomplete");

      const rejectOutbox = await admin.outboxEvent.count({
        where: {
          tenantId: tenantA,
          aggregateId: id,
          eventType: { contains: "reject" },
        },
      });
      assert.equal(rejectOutbox, 0, "reject is intentionally silent (no outbox)");
    });

    it("R2 POST /bookings/:id/reject without reason → rejected, reason null", async () => {
      const id = await createPending({ guestLabel: "R2 Guest" });
      const response = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${id}/reject`,
        tenantId: tenantA,
        userId: operatorA,
        body: {},
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.status, "rejected");
      assert.equal(response.body.rejectReason, undefined);

      const row = await admin.operatorRegistration.findUnique({ where: { id } });
      assert.equal(row?.status, "rejected");
      assert.equal(row?.rejectReason, null);
    });

    // ─── 4–5. waitlist / cancel ──────────────────────────────────────────

    it("W1 POST /bookings/:id/waitlist → 200 + registration.waitlisted outbox", async () => {
      const id = await createPending({ guestLabel: "W1 Guest" });
      const response = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${id}/waitlist`,
        tenantId: tenantA,
        userId: operatorA,
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.status, "waitlisted");

      const row = await admin.operatorRegistration.findUnique({ where: { id } });
      assert.equal(row?.status, "waitlisted");
      const outbox = await admin.outboxEvent.count({
        where: { tenantId: tenantA, aggregateId: id, eventType: "registration.waitlisted" },
      });
      assert.equal(outbox, 1);
    });

    it("X1 POST /bookings/:id/cancel → 200 + registration.cancelled outbox", async () => {
      const id = await createPending({ guestLabel: "X1 Guest" });
      const response = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${id}/cancel`,
        tenantId: tenantA,
        userId: operatorA,
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.status, "cancelled");

      const row = await admin.operatorRegistration.findUnique({ where: { id } });
      assert.equal(row?.status, "cancelled");
      const outbox = await admin.outboxEvent.count({
        where: { tenantId: tenantA, aggregateId: id, eventType: "registration.cancelled" },
      });
      assert.equal(outbox, 1);
    });

    // ─── 6. bulk-approve ─────────────────────────────────────────────────

    it("B1 POST /bookings/bulk-approve → both approved + outbox each", async () => {
      const a = await createPending({ guestLabel: "B1 A" });
      const b = await createPending({ guestLabel: "B1 B" });
      const response = await requestJson(listener, {
        method: "POST",
        path: "/bookings/bulk-approve",
        tenantId: tenantA,
        userId: operatorA,
        body: { ids: [a, b] },
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.ok(Array.isArray(response.body.approvedIds));
      assert.equal((response.body.approvedIds as string[]).length, 2);
      assert.ok(Array.isArray(response.body.skippedIds));
      assert.equal((response.body.skippedIds as string[]).length, 0);
      assert.equal(
        Object.keys(response.body).sort().join(","),
        "approvedIds,skippedIds"
      );

      for (const id of [a, b]) {
        const row = await admin.operatorRegistration.findUnique({ where: { id } });
        assert.equal(row?.status, "approved");
        assert.equal(
          await admin.outboxEvent.count({
            where: { tenantId: tenantA, aggregateId: id, eventType: "registration.approved" },
          }),
          1
        );
      }
    });

    // ─── 7–8. GET list / summary ─────────────────────────────────────────

    it("L1 GET /bookings ops list schema + tenant scope", async () => {
      const id = await createPending({ guestLabel: "L1 List Guest" });
      await createPending({
        guestLabel: "L1 Other Tenant",
        tenantId: tenantB,
        userId: operatorB,
      });

      const response = await requestJson(listener, {
        method: "GET",
        path: "/bookings?view=ops",
        tenantId: tenantA,
        userId: operatorA,
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.ok(Array.isArray(response.body.items));
      assert.equal(typeof response.body.total, "number");
      assert.ok(
        response.body.nextCursor === null || typeof response.body.nextCursor === "string"
      );

      const items = response.body.items as Array<Record<string, unknown>>;
      assert.ok(items.some((item) => item.id === id));
      assert.ok(items.every((item) => typeof item.guestLabel === "string"));
      assert.ok(items.every((item) => typeof item.status === "string"));
      assert.ok(!items.some((item) => item.guestLabel === "L1 Other Tenant"));
    });

    it("S1 GET /bookings/summary KPI schema", async () => {
      await createPending({ guestLabel: "S1 Pending" });
      const waitId = await createPending({ guestLabel: "S1 Wait" });
      await requestJson(listener, {
        method: "POST",
        path: `/bookings/${waitId}/waitlist`,
        tenantId: tenantA,
        userId: operatorA,
      });

      const response = await requestJson(listener, {
        method: "GET",
        path: "/bookings/summary",
        tenantId: tenantA,
        userId: operatorA,
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(typeof response.body.pending, "number");
      assert.equal(typeof response.body.approvedToday, "number");
      assert.equal(typeof response.body.departures7d, "number");
      assert.equal(typeof response.body.waitlist, "number");
      assert.ok(Array.isArray(response.body.tourChips));
      assert.ok((response.body.pending as number) >= 1);
      assert.ok((response.body.waitlist as number) >= 1);

      const pendingDb = await admin.operatorRegistration.count({
        where: { tenantId: tenantA, status: "pending" },
      });
      const waitDb = await admin.operatorRegistration.count({
        where: { tenantId: tenantA, status: "waitlisted" },
      });
      assert.equal(response.body.pending, pendingDb);
      assert.equal(response.body.waitlist, waitDb);
    });

    it("RC1 POST+GET /bookings/:id/receipts (member owner, Prisma finance)", async () => {
      const memberUserId = randomUUID();
      const id = await createPending({ guestLabel: "Receipt Guest" });
      await admin.operatorRegistration.update({
        where: { id },
        data: { submittedByUserId: memberUserId },
      });
      const fileKey = `receipts/${tenantA}/${id}/proof.jpg`;

      const before = await requestJson(listener, {
        method: "GET",
        path: `/bookings/${id}/receipts`,
        tenantId: tenantA,
        userId: memberUserId,
        role: "member",
      });
      assert.equal(before.status, 200, JSON.stringify(before.body));
      assert.equal(before.body.status, "none");

      const uploaded = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${id}/receipts`,
        tenantId: tenantA,
        userId: memberUserId,
        role: "member",
        body: { fileKey },
      });
      assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
      assert.equal(uploaded.body.status, "Pending");

      const after = await requestJson(listener, {
        method: "GET",
        path: `/bookings/${id}/receipts`,
        tenantId: tenantA,
        userId: memberUserId,
        role: "member",
      });
      assert.equal(after.status, 200, JSON.stringify(after.body));
      assert.equal(after.body.status, "pending");
    });

    // ─── Tenant isolation + RLS ──────────────────────────────────────────

    it("T1 foreign tenant cannot approve → 404 BOOKING_NOT_FOUND", async () => {
      const id = await createPending({ guestLabel: "T1 Owned by A" });
      const response = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${id}/approve`,
        tenantId: tenantB,
        userId: operatorB,
      });
      assert.equal(response.status, 404, JSON.stringify(response.body));
      assert.equal(response.body.code, "BOOKING_NOT_FOUND");

      const row = await admin.operatorRegistration.findUnique({ where: { id } });
      assert.equal(row?.status, "pending");
      assert.equal(row?.tenantId, tenantA);
    });

    it("T2 RLS: app_tour session for tenant B cannot read tenant A row", async () => {
      const id = await createPending({ guestLabel: "T2 RLS Guest" });

      const visibleToOwner = await withTenantRls(tenantA, async (tx) =>
        tx.operatorRegistration.findUnique({ where: { id } })
      );
      assert.ok(visibleToOwner !== null);
      assert.equal(visibleToOwner?.tenantId, tenantA);

      const leaked = await withTenantRls(tenantB, async (tx) =>
        tx.operatorRegistration.findUnique({ where: { id } })
      );
      assert.equal(leaked, null, "RLS must hide foreign-tenant booking from app role");
    });
  }
);
