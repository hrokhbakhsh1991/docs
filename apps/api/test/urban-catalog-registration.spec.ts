/**
 * Phase 8.2 — public urban catalog + registration HTTP (REQ-P8-020)
 * Authority: docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md §A–B
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { before, beforeEach, describe, it } from "node:test";

import { validateUrbanRegistrationPayload } from "@app-tour/workspace-urban";

import { createRequestListener } from "../src/app";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { resetHttpIdempotencyMemoryForTests } from "../src/http/http-idempotency";
import { resetPublicRegistrationThrottleForTests } from "../src/registrations/public-registration-throttle.ts";
import { resetUrbanRegistrationRepositoryForTests } from "@app-tour/workspace-urban/host/http";
import { setCachedTenantThemeById } from "../src/tenant/tenant-registry-cache";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const URBAN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const URBAN_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000410";
const URBAN_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000411";

function publicHeaders(
  tenantId = URBAN_TENANT_ID,
  idempotencyKey = randomUUID()
): Record<string, string> {
  return { "x-tenant-id": tenantId, "Idempotency-Key": idempotencyKey };
}

async function requestUrban(
  listener: ReturnType<typeof createRequestListener>,
  method: "GET" | "POST",
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

describe("Phase 8.2 — urban catalog + registration HTTP", () => {
  let listener: ReturnType<typeof createRequestListener>;
  let tourStore: InMemoryTourRepository;

  before(() => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    process.env.URBAN_TEST_WORKSPACE_TYPE = "urban";
    tourStore = new InMemoryTourRepository();
    tourStore.ensureUrbanPhase81PublishedTour();
    listener = createRequestListener({
      toursService: createTestToursService(tourStore),
      tourStore,
    });
  });

  beforeEach(() => {
    resetUrbanRegistrationRepositoryForTests();
    resetHttpIdempotencyMemoryForTests();
    resetPublicRegistrationThrottleForTests();
    setCachedTenantThemeById(URBAN_TENANT_ID, {
      urban: {
        catalog: { publicEnabled: true, slug: "catalog" },
        registration: { policy: "open", requirePhone: false },
      },
    });
  });

  it("UCAT-8.2-01 GET /urban/catalog lists published tours only", async () => {
    const response = await requestUrban(listener, "GET", "/urban/catalog", {
      headers: publicHeaders(),
    });
    assert.equal(response.status, 200);
    const items = (response.body as { data?: { items?: { id: string }[] } }).data?.items ?? [];
    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, URBAN_PUBLISHED_TOUR_ID);
  });

  it("UCAT-8.2-02 GET /urban/catalog/{tourId} returns 404 for draft tour", async () => {
    const response = await requestUrban(
      listener,
      "GET",
      `/urban/catalog/${URBAN_DRAFT_TOUR_ID}`,
      { headers: publicHeaders() }
    );
    assert.equal(response.status, 404);
  });

  it("UCAT-8.2-03 GET /urban/catalog/{tourId} returns 200 for published tour", async () => {
    const response = await requestUrban(
      listener,
      "GET",
      `/urban/catalog/${URBAN_PUBLISHED_TOUR_ID}`,
      { headers: publicHeaders() }
    );
    assert.equal(response.status, 200);
    const data = (response.body as {
      data?: {
        id?: string;
        publishStatus?: string;
        listSubtitle?: string;
        showListPrice?: boolean;
      };
    }).data;
    assert.equal(data?.id, URBAN_PUBLISHED_TOUR_ID);
    assert.equal(data?.publishStatus, "published");
    assert.ok(typeof data?.listSubtitle === "string" && data.listSubtitle.length > 0);
    assert.equal(data?.showListPrice, false);
  });

  it("UREG-8.2-01 POST /urban/registrations creates confirmed row when seats available", async () => {
    const response = await requestUrban(listener, "POST", "/urban/registrations", {
      headers: publicHeaders(),
      body: {
        tourId: URBAN_PUBLISHED_TOUR_ID,
        contact: { email: "guest@example.com", fullName: "Alex Guest" },
        partySize: 2,
      },
    });
    assert.equal(response.status, 201);
    const data = (response.body as { data?: { id?: string; status?: string } }).data;
    assert.ok(data?.id);
    assert.equal(data?.status, "confirmed");
  });

  it("UREG-8.2-02 POST /urban/registrations rejects invalid email with 400", async () => {
    const response = await requestUrban(listener, "POST", "/urban/registrations", {
      headers: publicHeaders(),
      body: {
        tourId: URBAN_PUBLISHED_TOUR_ID,
        contact: { email: "not-an-email", fullName: "Bad Email" },
      },
    });
    assert.equal(response.status, 400);
    assert.equal((response.body as { code?: string }).code, "ZOD_VALIDATION_FAILED");
  });

  it("UREG-8.2-03 POST /urban/registrations duplicate email returns 409", async () => {
    const body = {
      tourId: URBAN_PUBLISHED_TOUR_ID,
      contact: { email: "dup@example.com", fullName: "Dup Guest" },
    };
    const first = await requestUrban(listener, "POST", "/urban/registrations", {
      headers: publicHeaders(),
      body,
    });
    assert.equal(first.status, 201);
    const second = await requestUrban(listener, "POST", "/urban/registrations", {
      headers: publicHeaders(),
      body,
    });
    assert.equal(second.status, 409);
    assert.equal((second.body as { code?: string }).code, "URBAN_REGISTRATION_DUPLICATE");
  });

  it("UREG-8.2-05 POST /urban/registrations without Idempotency-Key returns 400", async () => {
    const response = await requestUrban(listener, "POST", "/urban/registrations", {
      headers: { "x-tenant-id": URBAN_TENANT_ID },
      body: {
        tourId: URBAN_PUBLISHED_TOUR_ID,
        contact: { email: "missing-idem@example.com", fullName: "No Key" },
      },
    });
    assert.equal(response.status, 400);
    assert.equal((response.body as { code?: string }).code, "IDEMPOTENCY_KEY_REQUIRED");
  });

  it("UREG-8.2-06 POST /urban/registrations replay same Idempotency-Key returns same id", async () => {
    const idempotencyKey = randomUUID();
    const body = {
      tourId: URBAN_PUBLISHED_TOUR_ID,
      contact: { email: "idem@example.com", fullName: "Idem Guest" },
    };
    const first = await requestUrban(listener, "POST", "/urban/registrations", {
      headers: publicHeaders(URBAN_TENANT_ID, idempotencyKey),
      body,
    });
    assert.equal(first.status, 201);
    const firstId = (first.body as { data?: { id?: string } }).data?.id;
    const second = await requestUrban(listener, "POST", "/urban/registrations", {
      headers: publicHeaders(URBAN_TENANT_ID, idempotencyKey),
      body,
    });
    assert.equal(second.status, 201);
    assert.equal((second.body as { data?: { id?: string } }).data?.id, firstId);
  });

  it("UREG-8.2-07 POST /urban/registrations rejects when policy is closed", async () => {
    setCachedTenantThemeById(URBAN_TENANT_ID, {
      urban: {
        catalog: { publicEnabled: true, slug: "catalog" },
        registration: { policy: "closed", requirePhone: false },
      },
    });
    const response = await requestUrban(listener, "POST", "/urban/registrations", {
      headers: publicHeaders(),
      body: {
        tourId: URBAN_PUBLISHED_TOUR_ID,
        contact: { email: "closed@example.com", fullName: "Closed Guest" },
      },
    });
    assert.equal(response.status, 403);
    assert.equal((response.body as { code?: string }).code, "URBAN_REGISTRATION_CLOSED");
  });

  it("UREG-8.2-04 plugin validateUrbanRegistrationPayload rejects invalid email", () => {
    assert.throws(
      () =>
        validateUrbanRegistrationPayload(
          { contact: { email: "bad", fullName: "x" } },
          { capacity: 100 }
        ),
      /URBAN_REGISTRATION_INVALID/
    );
  });
});
