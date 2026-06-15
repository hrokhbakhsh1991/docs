/**
 * Phase 9.3 — tours operator API
 * Authority: docs/phase-9/appendices/tours-operator-api-dispatch-addendum.md
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import { createRequestListener } from "../src/app";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

function starterTourBody(
  title: string,
  summary?: string,
  category?: string
): { data: Record<string, unknown> } {
  return {
    data: {
      basics: { title },
      details: { summary: summary ?? title },
      ...(category !== undefined ? { category } : {}),
    },
  };
}

installMemoryStorageDriverForDescribe();

type OperatorListResponse = {
  readonly items?: Array<Record<string, unknown>>;
  readonly total?: number;
  readonly page?: number;
  readonly limit?: number;
  readonly error?: string;
  readonly code?: string;
  readonly id?: string;
  readonly projection?: Record<string, unknown>;
};

function createOperatorTestListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

function denaliSmokeAuthHeaders(): Record<string, string> {
  return {
    "x-tenant-id": DENALI_SMOKE_TENANT_ID,
    "x-authenticated-tenant-id": DENALI_SMOKE_TENANT_ID,
    "x-user-id": OPERATOR_SMOKE.ownerUserId,
    "x-actor-role": "owner",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-denali-smoke",
  };
}

describe("tours-operator.spec.ts — Phase 9.3 API", () => {
  const client = installHttpTestClient(createOperatorTestListener);

  before(() => {
    seedOperatorIdentityFixture();
    const repo = getIdentityRepository();
    repo.seedUser({ id: OPERATOR_SMOKE.memberUserId, mobile: "+15550001003" });
    repo.seedMembership({
      userId: OPERATOR_SMOKE.memberUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-member",
    });
    repo.seedMembership({
      userId: OPERATOR_SMOKE.ownerUserId,
      tenantId: DENALI_SMOKE_TENANT_ID,
      role: "owner",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-denali-smoke",
    });
  });

  it("API-9.3-01 GET /tours?view=operator requires operator session", async () => {
    const response = await client.requestJson<OperatorListResponse>("GET", "/tours?view=operator");
    assert.equal(response.status, 401);
    assert.equal(response.body.code, "IDENTITY_REQUIRED");
  });

  it("CP-9.3-L01 operator list returns projection rows without canonical", async () => {
    const created = await client.requestJson<OperatorListResponse>("POST", "/tours", {
      headers: operatorAuthHeaders(),
      body: starterTourBody("Desert trek", "Sand dunes"),
    });
    assert.equal(created.status, 201);

    const list = await client.requestJson<OperatorListResponse>("GET", "/tours?view=operator", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(list.status, 200);
    assert.equal(list.body.items?.length, 1);
    const row = list.body.items![0]!;
    assert.equal(row.title, "Desert trek");
    assert.equal(row.uiStatus, "draft");
    assert.equal("canonical" in row, false);
    assert.equal(list.body.total, 1);
  });

  it("CP-9.3-L02 search filters title", async () => {
    await client.requestJson<OperatorListResponse>("POST", "/tours", {
      headers: operatorAuthHeaders(),
      body: starterTourBody("Alpine hike"),
    });
    await client.requestJson<OperatorListResponse>("POST", "/tours", {
      headers: operatorAuthHeaders(),
      body: starterTourBody("Coastal cruise"),
    });

    const list = await client.requestJson<OperatorListResponse>(
      "GET",
      "/tours?view=operator&search=alpine",
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(list.status, 200);
    assert.equal(list.body.items?.length, 1);
    assert.equal(list.body.items![0]!.title, "Alpine hike");
  });

  it("CP-9.3-L05 category filter matches projection.category", async () => {
    await client.requestJson<OperatorListResponse>("POST", "/tours", {
      headers: operatorAuthHeaders(),
      body: starterTourBody("Mountain day trek", undefined, "mountain_day"),
    });
    await client.requestJson<OperatorListResponse>("POST", "/tours", {
      headers: operatorAuthHeaders(),
      body: starterTourBody("Desert day trek", undefined, "desert_day"),
    });

    const list = await client.requestJson<OperatorListResponse>(
      "GET",
      "/tours?view=operator&category=mountain_day",
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(list.status, 200);
    assert.equal(list.body.items?.length, 1);
    assert.equal(list.body.items![0]!.title, "Mountain day trek");
    assert.equal(list.body.items![0]!.category, "mountain_day");
  });

  it("CP-9.3-L04 sort_by=title&sort_dir=asc orders rows", async () => {
    await client.requestJson<OperatorListResponse>("POST", "/tours", {
      headers: operatorAuthHeaders(),
      body: starterTourBody("Zulu tour"),
    });
    await client.requestJson<OperatorListResponse>("POST", "/tours", {
      headers: operatorAuthHeaders(),
      body: starterTourBody("Alpha tour"),
    });

    const list = await client.requestJson<OperatorListResponse>(
      "GET",
      "/tours?view=operator&sort_by=title&sort_dir=asc",
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(list.status, 200);
    assert.ok((list.body.items?.length ?? 0) >= 2);
    const titles = list.body.items!.map((row) => String(row.title));
    const sorted = [...titles].sort((left, right) => left.localeCompare(right));
    assert.deepEqual(titles, sorted);
  });

  it("API-9.3-E01 GET /tours/{id} requires operator session (CP-9.3-E01)", async () => {
    const created = await client.requestJson<OperatorListResponse>("POST", "/tours", {
      headers: operatorAuthHeaders(),
      body: starterTourBody("Session gate tour"),
    });
    assert.equal(created.status, 201);
    const tourId = String(created.body.id);

    const unauth = await client.requestJson<OperatorListResponse>("GET", `/tours/${tourId}`);
    assert.equal(unauth.status, 401);
    assert.equal(unauth.body.code, "UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT");
  });

  it("API-9.3-E02 GET /tours/{id} returns projection (CP-9.3-E02)", async () => {
    const created = await client.requestJson<OperatorListResponse>("POST", "/tours", {
      headers: operatorAuthHeaders(),
      body: starterTourBody("Detail projection tour"),
    });
    assert.equal(created.status, 201);
    const tourId = String(created.body.id);

    const detail = await client.requestJson<OperatorListResponse>("GET", `/tours/${tourId}`, {
      headers: operatorAuthHeaders(),
    });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.id, tourId);
    const projection = detail.body.projection;
    assert.ok(projection);
    assert.equal(projection.title, "Detail projection tour");
    assert.equal(projection.uiStatus, "draft");
    assert.equal("canonical" in (projection ?? {}), false);
  });

  it("API-9.3-02 member PATCH tour returns 403", async () => {
    const created = await client.requestJson<OperatorListResponse>("POST", "/tours", {
      headers: operatorAuthHeaders(),
      body: starterTourBody("Patch target"),
    });
    assert.equal(created.status, 201);
    const tourId = String(created.body.id);

    const patch = await client.requestJson<OperatorListResponse>("PATCH", `/tours/${tourId}`, {
      headers: {
        ...operatorAuthHeaders(),
        "x-user-id": OPERATOR_SMOKE.memberUserId,
        "x-actor-role": "member",
      },
      body: { data: { basics: { title: "Denied" } }, rowVersion: 1 },
    });
    assert.equal(patch.status, 403);
    assert.equal(patch.body.code, "OPERATOR_TOUR_WRITE_FORBIDDEN");
  });

  it("API-9.3-03 GET /tours/:id seeds denali memory smoke tour without prior list (FE-14/TR-09)", async () => {
    const detail = await client.requestJson<OperatorListResponse>(
      "GET",
      `/tours/${OPERATOR_SMOKE.seedTourId}`,
      { headers: denaliSmokeAuthHeaders() }
    );
    assert.equal(detail.status, 200);
    assert.equal(detail.body.id, OPERATOR_SMOKE.seedTourId);
    assert.equal(detail.body.tenantId, DENALI_SMOKE_TENANT_ID);
    assert.equal(typeof detail.body.projection, "object");
  });
});
