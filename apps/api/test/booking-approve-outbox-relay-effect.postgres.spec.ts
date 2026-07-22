/**
 * TODO-006 residual — approve HTTP enqueues outbox; relay tick marks status=done.
 * Fail-closed without DATABASE_URL(+ADMIN).
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
import { processOutboxRelayForTenantOnce } from "../src/outbox/outbox-relay";
import {
  drainDomainEventHandlers,
  integrationTenantId,
  preparePostgresOutboxIsolation,
  quiesceStaleOutboxProcessing,
} from "./test-helpers";
import { resetDomainEventBusForTests } from "@app-tour/platform-events";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

if (!hasDatabase) {
  throw new Error(
    "BOOKING_OUTBOX_RELAY_EFFECT_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN"
  );
}

function authHeaders(tenantId: string, userId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": userId,
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-outbox-effect",
  };
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly tenantId: string;
    readonly userId: string;
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
      if (payload !== undefined) req.write(payload);
      req.end();
    });
  });
}

describe("TODO-006 booking approve → outbox relay effect", { concurrency: false }, () => {
  const tenantId = integrationTenantId();
  const tourId = randomUUID();
  const operatorId = randomUUID();
  let admin: PrismaClient;
  const listener = createRequestListener();

  before(async () => {
    assert.equal(process.env.STORAGE_DRIVER?.trim().toLowerCase(), "prisma");
    process.env.OUTBOX_RELAY_ENABLED = "false";
    await preparePostgresOutboxIsolation();
    resetDomainEventBusForTests();
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
        subdomain: `fx-${tenantId.slice(0, 8)}`,
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

  it("approve enqueues pending outbox; relay tick → done", async () => {
    await quiesceStaleOutboxProcessing(0);
    const create = await requestJson(listener, {
      method: "POST",
      path: "/bookings",
      tenantId,
      userId: operatorId,
      body: {
        tourId,
        tourTitle: "Outbox Effect Tour",
        guestLabel: `FX-${randomUUID().slice(0, 8)}`,
        partySize: 1,
        departureAt: new Date(Date.now() + 86400000).toISOString(),
        registrationIntake: { tourCapacityMax: 10 },
      },
    });
    assert.equal(create.status, 201, JSON.stringify(create.body));
    const bookingId = create.body.id as string;

    const approve = await requestJson(listener, {
      method: "POST",
      path: `/bookings/${bookingId}/approve`,
      tenantId,
      userId: operatorId,
    });
    assert.equal(approve.status, 200, JSON.stringify(approve.body));

    const pending = await admin.outboxEvent.findMany({
      where: {
        tenantId,
        aggregateId: bookingId,
        eventType: "registration.approved",
        status: "pending",
      },
    });
    assert.equal(pending.length, 1, "approve must leave pending outbox");

    const result = await processOutboxRelayForTenantOnce(tenantId, 20);
    await drainDomainEventHandlers();
    assert.ok(result.claimed >= 1, JSON.stringify(result));
    assert.ok(result.published >= 1, JSON.stringify(result));
    assert.equal(result.failed, 0, JSON.stringify(result));

    const done = await admin.outboxEvent.findUnique({ where: { id: pending[0]!.id } });
    assert.equal(done?.status, "done");
    assert.ok(done?.processedAt !== null);
  });
});
