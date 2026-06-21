/**
 * P15-P-A2 — dashboard-critical API routes must not 500 after operator login
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { URBAN_SMOKE_E2E } from "./fixtures/urban-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type JsonBody = Record<string, unknown> & {
  readonly code?: string;
  readonly items?: unknown[];
};

function assertNotServerError(status: number, route: string): void {
  assert.notEqual(status, 500, `${route} must not return 500`);
}

function createDashboardTestListener() {
  const tourStore = new InMemoryTourRepository();
  tourStore.ensureUrbanPhase81PublishedTour();
  return createRequestListener({
    toursService: createTestToursService(tourStore),
    tourStore,
  });
}

function urbanOwnerHeaders(): Record<string, string> {
  return {
    "x-tenant-id": URBAN_SMOKE_E2E.tenantId,
    "x-authenticated-tenant-id": URBAN_SMOKE_E2E.tenantId,
    "x-user-id": URBAN_SMOKE_E2E.ownerUserId,
    "x-actor-role": "owner",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": URBAN_SMOKE_E2E.workspaceId,
  };
}

describe("operator-dashboard-runtime.spec.ts — P15-P-A2", () => {
  const client = installHttpTestClient(createDashboardTestListener);

  before(() => {
    seedOperatorIdentityFixture();
    const repo = getIdentityRepository();
    repo.seedUser({ id: URBAN_SMOKE_E2E.ownerUserId, mobile: "+15550004001" });
    repo.seedMembership({
      userId: URBAN_SMOKE_E2E.ownerUserId,
      tenantId: URBAN_SMOKE_E2E.tenantId,
      role: "owner",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: URBAN_SMOKE_E2E.workspaceId,
    });
  });

  it("API-P15-A2-01 denali GET /tours?view=operator returns 200", async () => {
    const response = await client.requestJson<JsonBody>("GET", "/tours?view=operator", {
      headers: operatorAuthHeaders(),
    });
    assertNotServerError(response.status, "denali GET /tours?view=operator");
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.items));
  });

  it("API-P15-A2-02 urban GET /tours?view=operator returns 200", async () => {
    const response = await client.requestJson<JsonBody>("GET", "/tours?view=operator", {
      headers: urbanOwnerHeaders(),
    });
    assertNotServerError(response.status, "urban GET /tours?view=operator");
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.items));
  });

  it("API-P15-A2-03 denali GET /settings/branding returns 200", async () => {
    const response = await client.requestJson<JsonBody>("GET", "/settings/branding", {
      headers: operatorAuthHeaders(),
    });
    assertNotServerError(response.status, "denali GET /settings/branding");
    assert.equal(response.status, 200);
  });

  it("API-P15-A2-04 urban GET /settings/branding returns 403 not 500", async () => {
    const response = await client.requestJson<JsonBody>("GET", "/settings/branding", {
      headers: urbanOwnerHeaders(),
    });
    assertNotServerError(response.status, "urban GET /settings/branding");
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "SETTINGS_WORKSPACE_FORBIDDEN");
  });

  it("API-P15-A2-05 denali GET /finance/reports/summary returns 200 empty summary on memory", async () => {
    const response = await client.requestJson<JsonBody>("GET", "/finance/reports/summary", {
      headers: operatorAuthHeaders(),
    });
    assertNotServerError(response.status, "denali GET /finance/reports/summary");
    assert.equal(response.status, 200);
    assert.equal(response.body.pendingManualPayments, 0);
    assert.equal(response.body.pendingReceiptReviews, 0);
  });

  it("API-P15-A2-06 urban GET /finance/reports/summary returns 404 not 500", async () => {
    const response = await client.requestJson<JsonBody>("GET", "/finance/reports/summary", {
      headers: urbanOwnerHeaders(),
    });
    assertNotServerError(response.status, "urban GET /finance/reports/summary");
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "FINANCE_WORKSPACE_UNSUPPORTED");
  });
});
