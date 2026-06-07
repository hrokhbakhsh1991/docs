/**
 * Phase 7.4 — urban HTTP E2E: create → publish + strip proof (REQ-P7-012..014).
 *
 * @see docs/phase-7/subphases/7.4-urban-e2e.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import http from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createRequestListener } from "../src/app";
import { resetTenantRegistryCacheForTests } from "../src/tenant/tenant-registry-cache";
import { resetValidationEngineCacheForTests } from "../src/tours/canonical-validation-sync";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";
import { URBAN_SMOKE_TENANT_ID } from "./fixtures/urban-demo-tenant";

const GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/workspaces/urban/test/fixtures/golden"
);

function loadGolden(filename: string): {
  schemaVersion: number;
  roots: string[];
  data: Record<string, unknown>;
} {
  return JSON.parse(readFileSync(join(GOLDEN_DIR, filename), "utf8")) as {
    schemaVersion: number;
    roots: string[];
    data: Record<string, unknown>;
  };
}

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "urban-e2e-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-urban-e2e",
  };
}

type TourResponse = {
  readonly status: number;
  readonly body: {
    id?: string;
    tenantId?: string;
    rowVersion?: number;
    canonical?: {
      data?: { tour?: { status?: string } };
    };
    error?: string;
    code?: string;
  };
};

async function requestTour(
  listener: ReturnType<typeof createRequestListener>,
  method: "POST" | "PATCH",
  path: string,
  body: unknown
): Promise<TourResponse> {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("urban-create-publish: no listen address"));
        return;
      }
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(payload)),
            ...authHeaders(URBAN_SMOKE_TENANT_ID),
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
              body: raw.length > 0 ? (JSON.parse(raw) as TourResponse["body"]) : {},
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

describe("7.4 urban create → publish (integration)", { concurrency: false }, () => {
  installMemoryStorageDriverForDescribe();

  let listener: ReturnType<typeof createRequestListener>;

  const priorDatabaseUrl = process.env.DATABASE_URL;
  const priorWorkers = process.env.P5_VALIDATION_WORKERS_ENABLED;

  before(() => {
    delete process.env.DATABASE_URL;
    process.env.P5_VALIDATION_WORKERS_ENABLED = "false";
    resetValidationEngineCacheForTests();
    resetTenantRegistryCacheForTests();
    process.env.NODE_ENV = "test";
    process.env.OUTBOX_RELAY_ENABLED = "false";
    listener = createRequestListener({ toursService: createTestToursService() });
  });

  beforeEach(() => {
    resetValidationEngineCacheForTests();
    resetTenantRegistryCacheForTests();
  });

  after(() => {
    if (priorDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = priorDatabaseUrl;
    }
    if (priorWorkers === undefined) {
      delete process.env.P5_VALIDATION_WORKERS_ENABLED;
    } else {
      process.env.P5_VALIDATION_WORKERS_ENABLED = priorWorkers;
    }
    resetTenantRegistryCacheForTests();
  });

  it("REQ-P7-012: POST /tours with urban-tour-minimal returns 201 and urban canonical", async () => {
    const golden = loadGolden("urban-tour-minimal.json");
    const res = await requestTour(listener, "POST", "/tours", golden);

    assert.equal(res.status, 201);
    assert.equal(res.body.tenantId, URBAN_SMOKE_TENANT_ID);
    assert.ok(res.body.id);
    assert.equal(res.body.canonical?.data?.tour?.status, "draft");
  });

  it("REQ-P7-013: PATCH /tours/:id publishes urban tour (status draft → published)", async () => {
    const golden = loadGolden("urban-tour-publish-ready.json");
    const created = await requestTour(listener, "POST", "/tours", golden);
    assert.equal(created.status, 201);
    assert.ok(created.body.id);

    const publishBody = {
      rowVersion: 1,
      data: {
        tour: {
          ...(golden.data.tour as Record<string, unknown>),
          status: "published",
        },
      },
    };

    const published = await requestTour(
      listener,
      "PATCH",
      `/tours/${created.body.id}`,
      publishBody
    );

    assert.equal(published.status, 200);
    assert.equal(published.body.rowVersion, 2);
    assert.equal(published.body.canonical?.data?.tour?.status, "published");
  });

  it("REQ-P7-014: urban-tour-invalid-itinerary.json returns 400 VALIDATION_FAILURE", async () => {
    const invalid = loadGolden("urban-tour-invalid-itinerary.json");
    const res = await requestTour(listener, "POST", "/tours", invalid);

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "VALIDATION_FAILURE");
    assert.match(res.body.error ?? "", /URBAN_FORBIDDEN_ITINERARY/);
  });
});
