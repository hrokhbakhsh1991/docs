/**
 * P6 VS-01 — denali catalog reflects publishStatus (API · smoke seed)
 * Publish lifecycle: tour-publish-transition.spec.ts (LC-04/LC-06) in p6:gate.
 * Wizard UI publish E2E deferred — composite canonical validation (P7 wizard).
 * @see docs/phase-19/platform-denali-vertical-slice.mdoc
 */
import assert from "node:assert/strict";
import http from "node:http";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const OPERATOR_SMOKE_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000211";

function publicHeaders(tenantId = OPERATOR_SMOKE_TENANT_ID): Record<string, string> {
  return { "x-tenant-id": tenantId };
}

async function requestDenali(
  listener: ReturnType<typeof createRequestListener>,
  method: "GET",
  path: string,
  options?: { headers?: Record<string, string> }
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
          method,
          headers: options?.headers,
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

describe("p6-vs01-admin-publish.spec.ts — P6 VS-01 API", () => {
  installMemoryStorageDriverForDescribe();

  let listener: ReturnType<typeof createRequestListener>;

  before(() => {
    const repo = new InMemoryTourRepository();
    repo.ensureOperatorSmokeSeedTour();
    const toursService = createTestToursService(repo);
    listener = createRequestListener({ toursService, tourStore: repo });
  });

  it("P6-VS-01-01 GET /denali/catalog lists published tours only", async () => {
    const response = await requestDenali(listener, "GET", "/denali/catalog", {
      headers: publicHeaders(),
    });
    assert.equal(response.status, 200);
    const items =
      (response.body as { data?: { items?: { id: string; title?: string }[] } }).data?.items ??
      [];
    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, OPERATOR_SMOKE_PUBLISHED_TOUR_ID);
    assert.equal(items[0]?.title, "North Ridge Trek");
  });

  it("P6-VS-01-02 GET /denali/catalog/{tourId} returns 404 for draft tour", async () => {
    const response = await requestDenali(
      listener,
      "GET",
      `/denali/catalog/${OPERATOR_SMOKE_DRAFT_TOUR_ID}`,
      { headers: publicHeaders() }
    );
    assert.equal(response.status, 404);
  });
});
