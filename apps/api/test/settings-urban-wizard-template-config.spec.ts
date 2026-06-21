/**
 * P15-P-B2 — urban wizard_template config API access
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { URBAN_SMOKE_TENANT_ID } from "@app-tour/workspace-urban";

import { createRequestListener } from "../src/app";
import { resetIdentityRepositoryForTests } from "../src/identity/create-identity-repository";
import { seedWorkspaceWizardTemplateForTenant } from "../src/settings/seed-workspace-wizard-template";
import { URBAN_SMOKE_E2E } from "./fixtures/urban-smoke-e2e-tenant";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type ConfigResponse = {
  readonly configKey?: string;
  readonly payload?: { readonly published?: boolean; readonly steps?: unknown[] };
  readonly code?: string;
};

function createUrbanConfigListener() {
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

describe("settings-urban-wizard-template-config.spec.ts — P15-P-B2", () => {
  const client = installHttpTestClient(createUrbanConfigListener);

  before(async () => {
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
    await seedWorkspaceWizardTemplateForTenant(URBAN_SMOKE_TENANT_ID);
  });

  it("API-P15-B2-01 urban owner GET /settings/config/wizard_template returns published seed", async () => {
    const response = await client.requestJson<ConfigResponse>(
      "GET",
      "/settings/config/wizard_template",
      { headers: urbanOwnerHeaders() }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.configKey, "wizard_template");
    assert.equal(response.body.payload?.published, true);
    assert.ok((response.body.payload?.steps?.length ?? 0) >= 2);
  });

  it("API-P15-B2-02 urban owner GET /settings/config/presets_advanced stays forbidden", async () => {
    const response = await client.requestJson<ConfigResponse>(
      "GET",
      "/settings/config/presets_advanced",
      { headers: urbanOwnerHeaders() }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "SETTINGS_WORKSPACE_FORBIDDEN");
  });
});
