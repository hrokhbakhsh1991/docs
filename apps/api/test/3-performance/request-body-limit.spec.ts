/**
 * Phase 3 step 1 — HTTP request body size limit (DEC-052 / SCAL-DEBT-03).
 */
import assert from "node:assert/strict";
import http from "node:http";
import { after, describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import {
  createTestToursService,
  installMemoryStorageDriverForDescribe,
  integrationTenantId,
} from "../test-helpers";

const VALID_TOUR_BODY = {
  schemaVersion: 1,
  roots: ["basics", "details"],
  data: { basics: { title: "body-limit-ok" }, details: { summary: "ok" } },
} as const;

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "body-limit-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-body-limit",
  };
}

async function postRawBody(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  payload: Buffer,
  contentLength?: number
): Promise<{ status: number; body: { error?: string; code?: string; correlationId?: string } }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...authHeaders(tenantId),
      };
      if (contentLength !== undefined) {
        headers["Content-Length"] = String(contentLength);
      } else {
        headers["Content-Length"] = String(payload.length);
      }
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/tours",
          method: "POST",
          headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body:
                raw.length > 0
                  ? (JSON.parse(raw) as { error?: string; code?: string; correlationId?: string })
                  : {},
            });
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

describe("request body size limit (DEC-052)", () => {
  installMemoryStorageDriverForDescribe();
  const previousLimit = process.env.HTTP_MAX_BODY_BYTES;

  after(() => {
    if (previousLimit === undefined) {
      delete process.env.HTTP_MAX_BODY_BYTES;
    } else {
      process.env.HTTP_MAX_BODY_BYTES = previousLimit;
    }
  });

  it("returns 201 for valid starter payload under default limit", async () => {
    delete process.env.HTTP_MAX_BODY_BYTES;
    const tenantId = integrationTenantId();
    const listener = createRequestListener({ toursService: createTestToursService() });
    const payload = Buffer.from(JSON.stringify(VALID_TOUR_BODY));
    const result = await postRawBody(listener, tenantId, payload);
    assert.equal(result.status, 201);
  });

  it("returns 413 when Content-Length exceeds HTTP_MAX_BODY_BYTES", async () => {
    process.env.HTTP_MAX_BODY_BYTES = "32";
    const tenantId = integrationTenantId();
    const listener = createRequestListener({ toursService: createTestToursService() });
    const payload = Buffer.alloc(64, 0x61);
    const result = await postRawBody(listener, tenantId, payload, 64);
    assert.equal(result.status, 413);
    assert.equal(result.body.error, "payload_too_large");
    assert.equal(result.body.code, "REQUEST_BODY_TOO_LARGE");
    assert.ok(typeof result.body.correlationId === "string");
  });

  it("returns 413 when streamed body exceeds HTTP_MAX_BODY_BYTES", async () => {
    process.env.HTTP_MAX_BODY_BYTES = "16";
    const tenantId = integrationTenantId();
    const listener = createRequestListener({ toursService: createTestToursService() });
    const payload = Buffer.alloc(32, 0x62);
    const result = await postRawBody(listener, tenantId, payload);
    assert.equal(result.status, 413);
    assert.equal(result.body.code, "REQUEST_BODY_TOO_LARGE");
  });
});
