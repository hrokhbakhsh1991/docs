/**
 * P6-0-N-002 — same tenantId across marketing, portal, admin hosts
 * @see docs/phase-19/p6/p6-0-host-subdomain.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

async function requestPublic(
  listener: ReturnType<typeof createRequestListener>,
  forwardedHost: string
): Promise<string | undefined> {
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
          path: "/public/tenant-context",
          method: "GET",
          headers: {
            host: "127.0.0.1",
            "x-forwarded-host": forwardedHost,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            const body = raw.length > 0 ? JSON.parse(raw) : null;
            resolve((body as { data?: { tenantId?: string } })?.data?.tenantId);
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

describe("p6-host-tenant-parity", () => {
  const listener = createRequestListener({ toursService: createTestToursService() });
  const expected = OPERATOR_SMOKE.tenantId;

  const hosts = [
    "operator.localhost",
    "operator.portal.localhost",
    "operator.admin.localhost",
    "shop.operator.localhost",
  ];

  for (const host of hosts) {
    it(`P6-HOST-${host} resolves operator tenant`, async () => {
      const tenantId = await requestPublic(listener, host);
      assert.equal(tenantId, expected);
    });
  }
});
