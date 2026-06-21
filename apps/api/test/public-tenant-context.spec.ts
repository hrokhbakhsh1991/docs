/**
 * Public tenant context — marketing shell bootstrap (M7)
 * @see docs/workspaces/denali/public-catalog.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { URBAN_SMOKE_E2E } from "./fixtures/urban-smoke-e2e-tenant";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

async function requestPublic(
  listener: ReturnType<typeof createRequestListener>,
  path: string,
  headers: Record<string, string>
): Promise<{ status: number; body: unknown }> {
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
          path,
          method: "GET",
          headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: raw.length > 0 ? JSON.parse(raw) : null,
            });
          });
        }
      );
      req.on("error", (error) => {
        server.close();
        reject(error);
      });
      req.end();
    });
  });
}

describe("public-tenant-context", () => {
  const listener = createRequestListener({ toursService: createTestToursService() });

  it("PTC-01 GET /public/tenant-context resolves operator host", async () => {
    const response = await requestPublic(listener, "/public/tenant-context", {
      host: "127.0.0.1",
      "x-forwarded-host": "operator.localhost",
    });
    assert.equal(response.status, 200);
    const data = (
      response.body as {
        data?: {
          tenantId?: string;
          pluginId?: string;
          siteSurfaces?: { admin?: boolean; marketing?: boolean; portal?: boolean };
        };
      }
    ).data;
    assert.equal(data?.tenantId, OPERATOR_SMOKE.tenantId);
    assert.equal(data?.pluginId, "denali");
    assert.equal(data?.siteSurfaces?.admin, true);
    assert.equal(data?.siteSurfaces?.marketing, true);
    assert.equal(data?.siteSurfaces?.portal, true);
  });

  it("PTC-02 GET /public/tenant-context resolves urban host", async () => {
    const response = await requestPublic(listener, "/public/tenant-context", {
      host: "127.0.0.1",
      "x-forwarded-host": "urban.localhost",
    });
    assert.equal(response.status, 200);
    const data = (response.body as { data?: { tenantId?: string; pluginId?: string } }).data;
    assert.equal(data?.tenantId, URBAN_SMOKE_E2E.tenantId);
    assert.equal(data?.pluginId, "urban");
  });

  it("PTC-02b GET /public/tenant-context resolves club admin host", async () => {
    const response = await requestPublic(listener, "/public/tenant-context", {
      host: "127.0.0.1",
      "x-forwarded-host": "operator.admin.localhost",
    });
    assert.equal(response.status, 200);
    const data = (response.body as { data?: { tenantId?: string; pluginId?: string } }).data;
    assert.equal(data?.tenantId, OPERATOR_SMOKE.tenantId);
    assert.equal(data?.pluginId, "denali");
  });

  it("PTC-03 unknown host returns 404", async () => {
    const response = await requestPublic(listener, "/public/tenant-context", {
      host: "127.0.0.1",
      "x-forwarded-host": "unknown-label.localhost",
    });
    assert.equal(response.status, 404);
  });
});
