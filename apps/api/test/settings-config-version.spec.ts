/**
 * Phase 9.6 — tenant config version (DEC-P9-010)
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { getSettingsConfigRepository } from "../src/settings/create-settings-config-repository";
import {
  resetTenantConfigInvalidationForTests,
  wasTenantConfigInvalidated,
} from "../src/settings/settings-config.service";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type ConfigResponse = Record<string, unknown>;

function createConfigTestListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

const VALID_PAYLOAD = {
  seedLabel: "SMK-P9-SEED",
  sections: [
    { id: "basics", label: "Basics", enabled: true },
    { id: "itinerary", label: "Itinerary", enabled: true },
  ],
};

const STARTER_TENANT_ID = "00000000-0000-4000-8000-000000000001";

const DENALI_PUBLISHED_FROZEN_STEPS = [
  {
    stepId: "denali_basic",
    label: "Basic",
    enabled: true,
    fields: [
      { canonicalPath: "category" },
      { canonicalPath: "title" },
      { canonicalPath: "destinationId" },
      { canonicalPath: "startDateTime" },
      { canonicalPath: "capacityMax" },
    ],
  },
  {
    stepId: "denali_photos",
    label: "Photos",
    enabled: true,
    fields: [
      { canonicalPath: "program.themeIds" },
      { canonicalPath: "photos" },
    ],
  },
  {
    stepId: "denali_logistics",
    label: "Logistics",
    enabled: true,
    fields: [{ canonicalPath: "transport.mode" }],
  },
] as const;

describe("settings-config-version.spec.ts — Phase 9.6 API", () => {
  const client = installHttpTestClient(createConfigTestListener);

  before(() => {
    seedOperatorIdentityFixture();
    resetTenantConfigInvalidationForTests();
  });

  it("API-9.6-CFG-01 PUT rejects unsupported config_version", async () => {
    const response = await client.requestJson<ConfigResponse>(
      "PUT",
      "/settings/config/wizard_template",
      {
        headers: operatorAuthHeaders(),
        body: {
          configVersion: 99,
          payload: VALID_PAYLOAD,
        },
      }
    );
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "SETTINGS_CONFIG_VERSION_UNSUPPORTED");
  });

  it("API-9.6-CFG-02 migrate payload on read when version lags", async () => {
    const repo = getSettingsConfigRepository();
    await repo.seed({
      tenantId: OPERATOR_SMOKE.tenantId,
      configKey: "wizard_template",
      configVersion: 0,
      payload: {
        seedLabel: "",
        sections: [{ id: "legacy", label: "Legacy section", enabled: true }],
      },
      updatedAt: new Date().toISOString(),
    });

    const response = await client.requestJson<ConfigResponse>(
      "GET",
      "/settings/config/wizard_template",
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.configVersion, 1);
    const payload = response.body.payload as Record<string, unknown>;
    assert.equal(typeof payload.seedLabel, "string");
    assert.ok(Array.isArray(payload.sections));
    assert.equal((payload.sections as Array<Record<string, unknown>>)[0]?.id, "legacy");
  });

  it("API-9.6-CFG-03 PUT wizard template persists and invalidates cache", async () => {
    resetTenantConfigInvalidationForTests();
    const response = await client.requestJson<ConfigResponse>(
      "PUT",
      "/settings/tour-wizard-template",
      {
        headers: operatorAuthHeaders(),
        body: {
          configVersion: 1,
          payload: VALID_PAYLOAD,
        },
      }
    );
    assert.equal(response.status, 200);
    const payload = response.body.payload as Record<string, unknown>;
    assert.equal(payload.seedLabel, "SMK-P9-SEED");
    assert.equal(wasTenantConfigInvalidated(OPERATOR_SMOKE.tenantId, "wizard_template"), true);
  });

  it("API-9.6-CFG-03b PUT wizard template persists fieldRulesOverlay", async () => {
    const response = await client.requestJson<ConfigResponse>(
      "PUT",
      "/settings/tour-wizard-template",
      {
        headers: operatorAuthHeaders(),
        body: {
          configVersion: 1,
          payload: {
            ...VALID_PAYLOAD,
            published: true,
            fieldRulesOverlay: {
              "program.longDescription": { visibility: "hidden" },
            },
            steps: [...DENALI_PUBLISHED_FROZEN_STEPS],
          },
        },
      }
    );
    assert.equal(response.status, 200);
    const payload = response.body.payload as Record<string, unknown>;
    assert.deepEqual(payload.fieldRulesOverlay, {
      "program.longDescription": { visibility: "hidden" },
    });
  });

  it("API-9.6-CFG-05 PUT rejects unknown wizard template field path", async () => {
    const response = await client.requestJson<ConfigResponse>(
      "PUT",
      "/settings/config/wizard_template",
      {
        headers: operatorAuthHeaders(),
        body: {
          configVersion: 1,
          payload: {
            ...VALID_PAYLOAD,
            published: true,
            steps: [
              {
                stepId: "basics",
                label: "Basics",
                enabled: true,
                fields: [{ canonicalPath: "not.in.registry" }],
              },
            ],
          },
        },
      }
    );
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "SETTINGS_WIZARD_UNKNOWN_FIELD");
  });

  it("API-9.6-CFG-06 PUT rejects denali title on starter (no path alias bridge)", async () => {
    const prevSeed = process.env.OPERATOR_SMOKE_E2E_SEED;
    const prevStorage = process.env.STORAGE_DRIVER;
    process.env.OPERATOR_SMOKE_E2E_SEED = "1";
    process.env.STORAGE_DRIVER = "memory";
    try {
      const response = await client.requestJson<ConfigResponse>(
        "PUT",
        "/settings/config/wizard_template",
        {
          headers: {
            "x-tenant-id": STARTER_TENANT_ID,
            "x-authenticated-tenant-id": STARTER_TENANT_ID,
            "x-user-id": OPERATOR_SMOKE.ownerUserId,
            "x-actor-role": "owner",
            "x-membership-status": "ACTIVE",
            "x-workspace-id": "ws-public-dev",
          },
          body: {
            configVersion: 1,
            payload: {
              seedLabel: "",
              sections: [],
              published: true,
              steps: [
                {
                  stepId: "denali_basic",
                  label: "Basic",
                  enabled: true,
                  fields: [{ canonicalPath: "title" }],
                },
              ],
            },
          },
        }
      );
      assert.equal(response.status, 400);
      assert.equal(response.body.code, "SETTINGS_WIZARD_UNKNOWN_FIELD");
      assert.equal(response.body.canonicalPath, "title");
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

  it("API-9.6-CFG-04 GET presets_advanced returns workspace defaults", async () => {
    const response = await client.requestJson<ConfigResponse>(
      "GET",
      "/settings/config/presets_advanced",
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.configKey, "presets_advanced");
    assert.equal(response.body.configVersion, 1);
    assert.equal(response.body.source, "workspace");
    const payload = response.body.payload as Record<string, unknown>;
    assert.equal(payload.autoMatchEnabled, false);
    assert.equal(payload.defaultPresetId, null);
    assert.ok(Array.isArray(payload.matchRules));
  });

  it("API-9.6-CFG-05 PUT presets_advanced persists via alias route", async () => {
    resetTenantConfigInvalidationForTests();
    const response = await client.requestJson<ConfigResponse>(
      "PUT",
      "/settings/tour-presets/advanced",
      {
        headers: operatorAuthHeaders(),
        body: {
          configVersion: 1,
          payload: {
            autoMatchEnabled: true,
            defaultPresetId: "preset-smk-01",
            matchRules: [
              {
                id: "rule-1",
                tourType: "day",
                themeId: null,
                presetId: "preset-smk-01",
                enabled: true,
              },
            ],
          },
        },
      }
    );
    assert.equal(response.status, 200);
    const payload = response.body.payload as Record<string, unknown>;
    assert.equal(payload.autoMatchEnabled, true);
    assert.equal(payload.defaultPresetId, "preset-smk-01");
    const rules = payload.matchRules as Array<Record<string, unknown>>;
    assert.equal(rules.length, 1);
    assert.equal(rules[0]?.id, "rule-1");
    assert.equal(wasTenantConfigInvalidated(OPERATOR_SMOKE.tenantId, "presets_advanced"), true);
  });
});
