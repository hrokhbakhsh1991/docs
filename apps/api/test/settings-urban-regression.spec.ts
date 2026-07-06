/**
 * Phase 9.6 — urban host hides Denali settings modules (RULE-P9-002 · R-P9-S04)
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { resetIdentityRepositoryForTests } from "../src/identity/create-identity-repository";
import { URBAN_SMOKE_E2E } from "./fixtures/urban-smoke-e2e-tenant";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type ModulesResponse = {
  readonly items?: Array<Record<string, unknown>>;
  readonly code?: string;
};

function createUrbanSettingsListener() {
  return createRequestListener({ toursService: createTestToursService() });
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

describe("settings-urban-regression.spec.ts — Phase 9.6 API", () => {
  const client = installHttpTestClient(createUrbanSettingsListener);

  before(() => {
    const repo = resetIdentityRepositoryForTests();
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

  it("API-9.6-URB-01 GET /settings/modules on urban host returns registry modules only", async () => {
    const response = await client.requestJson<ModulesResponse>("GET", "/settings/modules", {
      headers: urbanOwnerHeaders(),
    });
    assert.equal(response.status, 200);
    const ids = (response.body.items ?? []).map((item) => item.id);
    assert.deepEqual(ids, ["account_profile", "tour_wizard_template"]);
  });

  it("API-9.6-URB-03 GET /settings/branding on urban host returns module unknown", async () => {
    const response = await client.requestJson<ModulesResponse>("GET", "/settings/branding", {
      headers: urbanOwnerHeaders(),
    });
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "SETTINGS_MODULE_UNKNOWN");
  });

  it("API-9.6-URB-02 POST /settings/resources/equipment on urban host returns module unknown", async () => {
    const response = await client.requestJson<ModulesResponse>(
      "POST",
      "/settings/resources/equipment",
      {
        headers: urbanOwnerHeaders(),
        body: { name: "Urban forbidden equipment" },
      }
    );
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "SETTINGS_MODULE_UNKNOWN");
  });
});
