/**
 * Phase 8.4 — HTTP smoke chain SMK-P8-01..04 (no browser)
 * Authority: docs/phase-8/appendices/SMOKE-SCENARIO-MAP.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { before, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { encodeDevBearerToken } from "../src/tenant-kernel/parse-bearer";
import { getUrbanRegistrationRepository, resetUrbanRegistrationRepositoryForTests } from "@app-tour/workspace-urban/http";
import { URBAN_SMOKE_E2E } from "./fixtures/urban-smoke-e2e-tenant";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

function createUrbanSmokeListener(): ReturnType<typeof createRequestListener> {
  const tourStore = new InMemoryTourRepository();
  tourStore.ensureUrbanPhase81PublishedTour();
  return createRequestListener({
    toursService: createTestToursService(tourStore),
    tourStore,
  });
}

function publicHeaders(idempotencyKey = randomUUID()): Record<string, string> {
  return { "x-tenant-id": URBAN_SMOKE_E2E.tenantId, "Idempotency-Key": idempotencyKey };
}

function ownerBearer(): string {
  return encodeDevBearerToken({
    userId: URBAN_SMOKE_E2E.ownerUserId,
    tenantId: URBAN_SMOKE_E2E.tenantId,
    role: "owner",
    status: "ACTIVE",
    workspaceId: URBAN_SMOKE_E2E.workspaceId,
  });
}

function memberBearer(): string {
  return encodeDevBearerToken({
    userId: URBAN_SMOKE_E2E.memberUserId,
    tenantId: URBAN_SMOKE_E2E.tenantId,
    role: "member",
    status: "ACTIVE",
    workspaceId: URBAN_SMOKE_E2E.workspaceId,
  });
}

async function requestUrban(
  listener: ReturnType<typeof createRequestListener>,
  method: "GET" | "POST" | "PATCH",
  path: string,
  options?: { headers?: Record<string, string>; body?: unknown }
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
      const payload = options?.body === undefined ? undefined : JSON.stringify(options.body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: {
            ...options?.headers,
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": String(Buffer.byteLength(payload)),
                }
              : {}),
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
              body: raw.length > 0 ? JSON.parse(raw) : null,
            });
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

installMemoryStorageDriverForDescribe();

describe("SMK-P8-01 — public catalog browse", () => {
  let listener: ReturnType<typeof createRequestListener>;

  before(() => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    process.env.URBAN_TEST_WORKSPACE_TYPE = "urban";
    listener = createUrbanSmokeListener();
  });

  it("returns 200 with published tour only", async () => {
    const response = await requestUrban(listener, "GET", "/urban/catalog", {
      headers: publicHeaders(),
    });
    assert.equal(response.status, 200);
    const items = (response.body as { data?: { items?: { id: string; title?: string }[] } }).data
      ?.items;
    assert.ok(items);
    assert.equal(items!.length, 1);
    assert.equal(items![0]?.id, URBAN_SMOKE_E2E.publishedTourId);
    assert.equal(items![0]?.title, URBAN_SMOKE_E2E.publishedTourTitle);
  });
});

describe("SMK-P8-02 — public registration intake", () => {
  let listener: ReturnType<typeof createRequestListener>;

  before(() => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    process.env.URBAN_TEST_WORKSPACE_TYPE = "urban";
    listener = createUrbanSmokeListener();
  });

  beforeEach(() => {
    resetUrbanRegistrationRepositoryForTests();
  });

  it("returns 201 and persists registration row", async () => {
    const response = await requestUrban(listener, "POST", "/urban/registrations", {
      headers: publicHeaders(),
      body: {
        tourId: URBAN_SMOKE_E2E.publishedTourId,
        contact: {
          email: URBAN_SMOKE_E2E.registrationEmail,
          fullName: "Smoke Tester",
        },
        partySize: 2,
      },
    });
    assert.equal(response.status, 201);
    const id = (response.body as { data?: { id?: string } }).data?.id;
    assert.ok(id);
    const row = await getUrbanRegistrationRepository().findByTenantTourEmail(
      URBAN_SMOKE_E2E.tenantId,
      URBAN_SMOKE_E2E.publishedTourId,
      URBAN_SMOKE_E2E.registrationEmail
    );
    assert.ok(row);
    assert.equal(row!.id, id);
  });
});

describe("SMK-P8-03 — owner settings load", () => {
  let listener: ReturnType<typeof createRequestListener>;

  before(() => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    process.env.URBAN_TEST_WORKSPACE_TYPE = "urban";
    listener = createUrbanSmokeListener();
  });

  it("returns 200 urban settings envelope for owner", async () => {
    const response = await requestUrban(listener, "GET", "/urban/settings", {
      headers: { Authorization: ownerBearer() },
    });
    assert.equal(response.status, 200);
    const urban = (response.body as { data?: { urban?: { catalog?: { slug?: string } } } }).data
      ?.urban;
    assert.equal(urban?.catalog?.slug, "catalog");
  });
});

describe("SMK-P8-04 — member denied settings", () => {
  let listener: ReturnType<typeof createRequestListener>;

  before(() => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    process.env.URBAN_TEST_WORKSPACE_TYPE = "urban";
    listener = createUrbanSmokeListener();
  });

  it("GET /urban/settings returns 403 URBAN_OWNER_REQUIRED for member", async () => {
    const response = await requestUrban(listener, "GET", "/urban/settings", {
      headers: { Authorization: memberBearer() },
    });
    assert.equal(response.status, 403);
    assert.equal((response.body as { code?: string }).code, "URBAN_OWNER_REQUIRED");
  });

  it("PATCH /urban/settings returns 403 URBAN_OWNER_REQUIRED for member", async () => {
    const response = await requestUrban(listener, "PATCH", "/urban/settings", {
      headers: { Authorization: memberBearer() },
      body: {
        urban: {
          catalog: { publicEnabled: true, slug: "catalog" },
          registration: { policy: "open" },
        },
      },
    });
    assert.equal(response.status, 403);
    assert.equal((response.body as { code?: string }).code, "URBAN_OWNER_REQUIRED");
  });
});
