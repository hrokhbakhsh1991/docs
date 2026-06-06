/**
 * 4-integration — malformed JSON → 400 INVALID_JSON (DEC-092 / SV-11).
 *
 * @see docs/phase-5/appendices/http-malformed-json.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { describe, it, before } from "node:test";

import { createRequestListener } from "../../src/app";
import {
  createTestToursService,
  installMemoryStorageDriverForDescribe,
  integrationTenantId,
} from "../test-helpers";

const VALID_TOUR_BODY = {
  schemaVersion: 1,
  roots: ["basics", "details"],
  data: { basics: { title: "malformed-json-ok" }, details: { summary: "ok" } },
} as const;

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "malformed-json-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-malformed-json",
  };
}

async function postRawBody(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  payload: string
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
      const body = Buffer.from(payload, "utf8");
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/tours",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(body.length),
            ...authHeaders(tenantId),
          },
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
                  ? (JSON.parse(raw) as {
                      error?: string;
                      code?: string;
                      correlationId?: string;
                    })
                  : {},
            });
          });
        }
      );
      req.on("error", (error) => {
        server.close();
        reject(error);
      });
      req.write(body);
      req.end();
    });
  });
}

describe("4-integration — malformed JSON body (DEC-092)", () => {
  installMemoryStorageDriverForDescribe();
  let listener: ReturnType<typeof createRequestListener>;
  const tenantId = integrationTenantId();

  before(() => {
    listener = createRequestListener({ toursService: createTestToursService() });
  });

  it("returns 400 INVALID_JSON for syntax errors", async () => {
    const res = await postRawBody(listener, tenantId, '{"broken":');
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "INVALID_JSON");
    assert.equal(res.body.error, "invalid_json");
    assert.ok(res.body.correlationId);
  });

  it("returns 201 for valid JSON tour body", async () => {
    const res = await postRawBody(listener, tenantId, JSON.stringify(VALID_TOUR_BODY));
    assert.equal(res.status, 201);
  });
});
