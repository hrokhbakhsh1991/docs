/**
 * Phase 9.6 — settings resource router (DEC-P9-009 · DEC-P9-010)
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { getSettingsResourcesRepository } from "../src/settings/create-settings-resources-repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type ResourceResponse = Record<string, unknown>;

function createSettingsResourcesListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

describe("settings-resources.spec.ts — Phase 9.6 API", () => {
  const client = installHttpTestClient(createSettingsResourcesListener);

  before(() => {
    seedOperatorIdentityFixture();
  });

  it("API-9.6-RES-01 unknown moduleId returns 404 SETTINGS_MODULE_UNKNOWN", async () => {
    const response = await client.requestJson<ResourceResponse>(
      "GET",
      "/settings/resources/unknown_xyz",
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "SETTINGS_MODULE_UNKNOWN");
  });

  it("API-9.6-RES-02 equipment CRUD tenant-scoped", async () => {
    const createRes = await client.requestJson<ResourceResponse>(
      "POST",
      "/settings/resources/equipment",
      {
        headers: operatorAuthHeaders(),
        body: {
          name: "Trekking Poles",
          themeIds: ["00000000-0000-4000-8000-000000000701"],
        },
      }
    );
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.name, "Trekking Poles");
    assert.deepEqual(createRes.body.themeIds, ["00000000-0000-4000-8000-000000000701"]);
    const itemId = createRes.body.id as string;

    const listRes = await client.requestJson<ResourceResponse>(
      "GET",
      "/settings/resources/equipment",
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(listRes.status, 200);
    const items = listRes.body.items as Array<Record<string, unknown>>;
    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, itemId);

    const patchRes = await client.requestJson<ResourceResponse>(
      "PATCH",
      `/settings/resources/equipment/${itemId}`,
      {
        headers: operatorAuthHeaders(),
        body: { name: "Carbon Poles" },
      }
    );
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.name, "Carbon Poles");

    const deleteRes = await client.requestJson<ResourceResponse>(
      "DELETE",
      `/settings/resources/equipment/${itemId}`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(deleteRes.status, 204);
  });

  it("API-9.6-RES-03 cross-tenant item id denied by RLS", async () => {
    const repo = getSettingsResourcesRepository();
    const foreignTenantId = "00000000-0000-4000-8000-000000000099";
    const foreignItemId = "00000000-0000-4000-8000-000000000501";
    await repo.seedEquipment({
      id: foreignItemId,
      tenantId: foreignTenantId,
      name: "Foreign Tent",
      category: null,
      themeIds: [],
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const getRes = await client.requestJson<ResourceResponse>(
      "PATCH",
      `/settings/resources/equipment/${foreignItemId}`,
      {
        headers: operatorAuthHeaders(),
        body: { name: "Should Fail" },
      }
    );
    assert.equal(getRes.status, 404);
    assert.equal(getRes.body.code, "SETTINGS_RESOURCE_NOT_FOUND");
    assert.equal(getRes.body.itemId, foreignItemId);
    assert.notEqual(OPERATOR_SMOKE.tenantId, foreignTenantId);
  });

  it("API-9.6-RES-04 tour_themes CRUD tenant-scoped", async () => {
    const createRes = await client.requestJson<ResourceResponse>(
      "POST",
      "/settings/resources/tour_themes",
      {
        headers: operatorAuthHeaders(),
        body: { name: "Alpine Trek", slug: "alpine-trek" },
      }
    );
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.name, "Alpine Trek");
    assert.equal(createRes.body.slug, "alpine-trek");
    const itemId = createRes.body.id as string;

    const listRes = await client.requestJson<ResourceResponse>(
      "GET",
      "/settings/resources/tour_themes",
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(listRes.status, 200);
    const items = listRes.body.items as Array<Record<string, unknown>>;
    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, itemId);

    const deleteRes = await client.requestJson<ResourceResponse>(
      "DELETE",
      `/settings/resources/tour_themes/${itemId}`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(deleteRes.status, 204);
  });

  it("API-9.6-RES-05 locations region + destination with FK", async () => {
    const regionRes = await client.requestJson<ResourceResponse>(
      "POST",
      "/settings/resources/locations",
      {
        headers: operatorAuthHeaders(),
        body: { entity: "region", name: "Alps", country: "CH" },
      }
    );
    assert.equal(regionRes.status, 201);
    const regionId = regionRes.body.id as string;

    const destinationRes = await client.requestJson<ResourceResponse>(
      "POST",
      "/settings/resources/locations",
      {
        headers: operatorAuthHeaders(),
        body: { entity: "destination", regionId, name: "Zermatt" },
      }
    );
    assert.equal(destinationRes.status, 201);
    assert.equal(destinationRes.body.regionId, regionId);

    const listRes = await client.requestJson<ResourceResponse>(
      "GET",
      "/settings/resources/locations",
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(listRes.status, 200);
    const regions = listRes.body.regions as Array<Record<string, unknown>>;
    const destinations = listRes.body.destinations as Array<Record<string, unknown>>;
    assert.equal(regions.length, 1);
    assert.equal(destinations.length, 1);

    const deleteRegionRes = await client.requestJson<ResourceResponse>(
      "DELETE",
      `/settings/resources/locations/${regionId}`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(deleteRegionRes.status, 204);

    const listAfterDelete = await client.requestJson<ResourceResponse>(
      "GET",
      "/settings/resources/locations",
      {
        headers: operatorAuthHeaders(),
      }
    );
    const destinationsAfter = listAfterDelete.body.destinations as Array<Record<string, unknown>>;
    assert.equal(destinationsAfter.length, 0);
  });

  it("API-9.6-RES-06 guide_languages CRUD tenant-scoped", async () => {
    const createRes = await client.requestJson<ResourceResponse>(
      "POST",
      "/settings/resources/guide_languages",
      {
        headers: operatorAuthHeaders(),
        body: { name: "English", slug: "english" },
      }
    );
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.name, "English");
    assert.equal(createRes.body.slug, "english");
    const itemId = createRes.body.id as string;

    const listRes = await client.requestJson<ResourceResponse>(
      "GET",
      "/settings/resources/guide_languages",
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(listRes.status, 200);
    const items = listRes.body.items as Array<Record<string, unknown>>;
    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, itemId);

    const deleteRes = await client.requestJson<ResourceResponse>(
      "DELETE",
      `/settings/resources/guide_languages/${itemId}`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(deleteRes.status, 204);
  });

  it("API-9.6-RES-07 tour_presets CRUD with theme FK", async () => {
    const themeRes = await client.requestJson<ResourceResponse>(
      "POST",
      "/settings/resources/tour_themes",
      {
        headers: operatorAuthHeaders(),
        body: { name: "Denali Pilot", slug: "denali-pilot" },
      }
    );
    assert.equal(themeRes.status, 201);
    const themeId = themeRes.body.id as string;

    const createRes = await client.requestJson<ResourceResponse>(
      "POST",
      "/settings/resources/tour_presets",
      {
        headers: operatorAuthHeaders(),
        body: { name: "Weekend Trek", description: "2-day preset", themeId },
      }
    );
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.themeId, themeId);
    const itemId = createRes.body.id as string;

    const badThemeRes = await client.requestJson<ResourceResponse>(
      "POST",
      "/settings/resources/tour_presets",
      {
        headers: operatorAuthHeaders(),
        body: {
          name: "Invalid FK",
          themeId: "00000000-0000-4000-8000-000000000777",
        },
      }
    );
    assert.equal(badThemeRes.status, 404);
    assert.equal(badThemeRes.body.code, "SETTINGS_RESOURCE_NOT_FOUND");

    const deleteRes = await client.requestJson<ResourceResponse>(
      "DELETE",
      `/settings/resources/tour_presets/${itemId}`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(deleteRes.status, 204);
  });
});
