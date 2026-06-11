/**
 * Phase 9.6 — settings modules API
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type SettingsModulesResponse = {
  readonly items?: Array<Record<string, unknown>>;
};

function createSettingsTestListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

describe("settings-modules.spec.ts — Phase 9.6 API", () => {
  const client = installHttpTestClient(createSettingsTestListener);

  before(() => {
    seedOperatorIdentityFixture();
  });

  it("API-9.6-01 GET settings modules requires session", async () => {
    const unauth = await client.requestJson<SettingsModulesResponse>("GET", "/settings/modules");
    assert.equal(unauth.status, 401);

    const authed = await client.requestJson<SettingsModulesResponse>("GET", "/settings/modules", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(authed.status, 200);
    assert.ok(Array.isArray(authed.body.items));
    assert.ok((authed.body.items?.length ?? 0) >= 1);
    const branding = authed.body.items?.find((item) => item.id === "workspace_branding");
    assert.ok(branding !== undefined);
    assert.equal(branding?.kind, "readonly_explorer");
    const account = authed.body.items?.find((item) => item.id === "account_profile");
    assert.ok(account !== undefined);
    assert.equal(account?.kind, "account_preference");
    const equipment = authed.body.items?.find((item) => item.id === "equipment");
    assert.ok(equipment !== undefined);
    assert.equal(equipment?.kind, "reference_data");
    const reconciliation = authed.body.items?.find((item) => item.id === "reconciliation_triage");
    assert.ok(reconciliation !== undefined);
    assert.equal(reconciliation?.kind, "readonly_explorer");
  });

  it("API-9.6-03 denali dev tenant lists full denali settings modules", async () => {
    const denaliTenantId = "00000000-0000-4000-8000-000000000003";
    const authed = await client.requestJson<SettingsModulesResponse>("GET", "/settings/modules", {
      headers: {
        ...operatorAuthHeaders(),
        "x-tenant-id": denaliTenantId,
        "x-authenticated-tenant-id": denaliTenantId,
      },
    });
    assert.equal(authed.status, 200);
    const ids = (authed.body.items ?? []).map((item) => item.id);
    assert.ok(ids.includes("equipment"));
    assert.ok(ids.includes("locations"));
    assert.ok(ids.includes("tour_wizard_template"));
    assert.ok(ids.includes("reconciliation_triage"));
  });

  it("API-9.6-02 operator smoke memory lists full denali settings modules", async () => {
    const prevSeed = process.env.OPERATOR_SMOKE_E2E_SEED;
    const prevStorage = process.env.STORAGE_DRIVER;
    process.env.OPERATOR_SMOKE_E2E_SEED = "1";
    process.env.STORAGE_DRIVER = "memory";
    try {
      const authed = await client.requestJson<SettingsModulesResponse>("GET", "/settings/modules", {
        headers: operatorAuthHeaders(),
      });
      assert.equal(authed.status, 200);
      const ids = (authed.body.items ?? []).map((item) => item.id);
      assert.ok(ids.includes("account_profile"));
      assert.ok(ids.includes("tour_wizard_template"));
      assert.ok(ids.includes("equipment"));
      assert.ok(ids.includes("locations"));
      assert.ok(ids.includes("tour_themes"));
      assert.ok(ids.includes("reconciliation_triage"));
    } finally {
      if (prevSeed === undefined) {
        delete process.env.OPERATOR_SMOKE_E2E_SEED;
      } else {
        process.env.OPERATOR_SMOKE_E2E_SEED = prevSeed;
      }
      if (prevStorage === undefined) {
        delete process.env.STORAGE_DRIVER;
      } else {
        process.env.STORAGE_DRIVER = prevStorage;
      }
    }
  });
});
