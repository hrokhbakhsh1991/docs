/**
 * TODO-007 — parallel HTTP guest duplicate race against Postgres unique indexes.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
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
import { disconnectPrisma } from "../src/db/prisma";
import { integrationTenantId } from "./test-helpers";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

if (!hasDatabase) {
  throw new Error(
    "BOOKING_GUEST_RACE_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN (TODO-007)"
  );
}

function authHeaders(tenantId: string, userId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": userId,
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-guest-race",
  };
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly tenantId: string;
    readonly userId: string;
    readonly body: unknown;
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
      const payload = JSON.stringify(input.body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: input.path,
          method: input.method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(payload)),
            ...authHeaders(input.tenantId, input.userId),
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
        }
      );
      req.on("error", (error) => {
        server.close();
        reject(error);
      });
      req.write(payload);
      req.end();
    });
  });
}

describe("TODO-007 parallel HTTP guest duplicate race", { concurrency: false }, () => {
  const tenantId = integrationTenantId();
  const tourId = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const guestLabel = `RaceGuest-${randomUUID().slice(0, 8)}`;
  let admin: PrismaClient;
  const listener = createRequestListener();

  before(async () => {
    assert.equal(process.env.STORAGE_DRIVER?.trim().toLowerCase(), "prisma");
    process.env.OUTBOX_RELAY_ENABLED = "false";
    resetLazyRouteHandlersForTests();
    resetLazyFinanceServiceForTests();
    resetBookingsRepositorySingletonForTests();
    resetBookingsServiceCompositionForTests();
    admin = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_ADMIN!.trim() } },
    });
    await admin.tenant.create({
      data: {
        id: tenantId,
        subdomain: `race-${tenantId.slice(0, 8)}`,
        workspaceType: "denali",
        theme: {},
      },
    });
    assert.ok(getBookingsRepository() instanceof PrismaBookingsRepository);
  });

  after(async () => {
    try {
      await admin.outboxEvent.deleteMany({ where: { tenantId } });
      await admin.operatorRegistration.deleteMany({ where: { tenantId } });
      await admin.tenant.deleteMany({ where: { id: tenantId } });
    } finally {
      await admin.$disconnect();
      await disconnectPrisma();
    }
  });

  it("two concurrent POST /bookings same guestLabel → one 201 and one 409", async () => {
    const body = {
      tourId,
      tourTitle: "Race Tour",
      guestLabel,
      partySize: 1,
      departureAt: new Date(Date.now() + 86400000).toISOString(),
      registrationIntake: { tourCapacityMax: 50 },
    };
    const [a, b] = await Promise.all([
      requestJson(listener, {
        method: "POST",
        path: "/bookings",
        tenantId,
        userId: userA,
        body,
      }),
      requestJson(listener, {
        method: "POST",
        path: "/bookings",
        tenantId,
        userId: userB,
        body,
      }),
    ]);
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    assert.deepEqual(statuses, [201, 409], JSON.stringify({ a, b }));
    const loser = a.status === 409 ? a : b;
    assert.ok(
      loser.body.code === "BOOKING_GUEST_DUPLICATE" ||
        String(loser.body.error ?? "").includes("BOOKING_GUEST_DUPLICATE") ||
        String(loser.body.message ?? "").includes("BOOKING_GUEST_DUPLICATE") ||
        loser.body.code === "UNIQUE_CONSTRAINT_VIOLATION",
      JSON.stringify(loser.body)
    );
    const count = await admin.operatorRegistration.count({
      where: { tenantId, tourId, guestLabel },
    });
    assert.equal(count, 1);
  });
});
