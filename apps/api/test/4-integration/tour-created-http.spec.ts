/**
 * Phase 4.5 — HTTP integration: POST /tours emits TourCreated with tenantId (P4-E-EVT-01).
 *
 * @see docs/phase-4/appendices/tour-created-http-integration.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import {
  flushDomainEventDispatch,
  resetDomainEventBusForTests,
  subscribeDomainEvent,
  type DomainEventEnvelope,
} from "@app-tour/platform-events";

import { createRequestListener } from "../../src/app";
import { createTestToursService, integrationTenantId } from "../test-helpers";

const ENV_SNAPSHOT = {
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
  OUTBOX_RELAY_ENABLED: process.env.OUTBOX_RELAY_ENABLED,
  NODE_ENV: process.env.NODE_ENV,
};

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "tour-created-http",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-tour-created-http",
  };
}

async function postTour(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string
): Promise<{ status: number; body: { id?: string; tenantId?: string } }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("tour-created-http: no listen address"));
        return;
      }
      const payload = JSON.stringify({
        data: { basics: { title: "http-tour-created" }, details: { summary: "evt" } },
      });
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/tours",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(payload)),
            ...authHeaders(tenantId),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: raw.length > 0 ? (JSON.parse(raw) as { id?: string; tenantId?: string }) : {},
            });
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      req.write(payload);
      req.end();
    });
  });
}

describe("4-integration — POST /tours emits TourCreated (P4-E-EVT-01)", () => {
  before(() => {
    resetDomainEventBusForTests();
    process.env.NODE_ENV = "test";
    process.env.STORAGE_DRIVER = "memory";
    process.env.OUTBOX_RELAY_ENABLED = "false";
  });

  after(() => {
    if (ENV_SNAPSHOT.STORAGE_DRIVER === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = ENV_SNAPSHOT.STORAGE_DRIVER;
    }
    if (ENV_SNAPSHOT.OUTBOX_RELAY_ENABLED === undefined) {
      delete process.env.OUTBOX_RELAY_ENABLED;
    } else {
      process.env.OUTBOX_RELAY_ENABLED = ENV_SNAPSHOT.OUTBOX_RELAY_ENABLED;
    }
    if (ENV_SNAPSHOT.NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = ENV_SNAPSHOT.NODE_ENV;
    }
  });

  it("HTTP POST /tours publishes TourCreated with matching tenantId on memory driver", async () => {
    const tenantId = integrationTenantId();
    const seen: DomainEventEnvelope<{ tourId: string }>[] = [];
    subscribeDomainEvent("TourCreated", (evt) => {
      seen.push(evt);
    });

    const listener = createRequestListener({ toursService: createTestToursService() });
    const res = await postTour(listener, tenantId);

    assert.equal(res.status, 201);
    assert.equal(res.body.tenantId, tenantId);
    assert.ok(res.body.id);

    await flushDomainEventDispatch();
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.tenantId, tenantId);
    assert.equal(seen[0]?.payload.tourId, res.body.id);
  });
});
