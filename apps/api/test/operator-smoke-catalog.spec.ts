/**
 * Phase 11.0 — operator smoke reference catalog seed
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { getSettingsResourcesRepository, resetSettingsResourcesRepositorySingletonForTests } from "../src/settings/create-settings-resources-repository";
import {
  DENALI_SMOKE_TENANT_ID,
  OPERATOR_SMOKE_TENANT_ID,
  seedOperatorSmokeCatalog,
} from "../src/settings/seed-operator-smoke-catalog";
import { installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

describe("operator-smoke-catalog.spec.ts — Phase 11.0", () => {
  before(async () => {
    const repo = getSettingsResourcesRepository();
    await seedOperatorSmokeCatalog(repo);
  });

  it("API-11.0-02 seeds equipment, locations, and themes for operator smoke tenant", async () => {
    const repo = getSettingsResourcesRepository();
    const equipment = await repo.listEquipment(OPERATOR_SMOKE_TENANT_ID);
    assert.ok(equipment.length >= 1);

    const destinations = await repo.listDestinations(OPERATOR_SMOKE_TENANT_ID);
    const regions = await repo.listRegions(OPERATOR_SMOKE_TENANT_ID);
    assert.ok(destinations.length >= 1);
    assert.ok(regions.length >= 1);

    const themes = await repo.listTourThemes(OPERATOR_SMOKE_TENANT_ID);
    assert.ok(themes.length >= 1);
  });

  it("API-11.0-03 seeds at least three destinations for denali dev tenant", async () => {
    resetSettingsResourcesRepositorySingletonForTests();
    const repo = getSettingsResourcesRepository();
    await seedOperatorSmokeCatalog(repo, { tenantId: DENALI_SMOKE_TENANT_ID });
    const equipment = await repo.listEquipment(DENALI_SMOKE_TENANT_ID);
    const regions = await repo.listRegions(DENALI_SMOKE_TENANT_ID);
    const destinations = await repo.listDestinations(DENALI_SMOKE_TENANT_ID);
    const activeCount = destinations.filter((item) => item.isActive).length;
    assert.ok(
      activeCount >= 3,
      `equipment=${equipment.length} regions=${regions.length} destinations=${activeCount} names=${destinations.map((item) => item.name).join(", ")}`
    );
  });
});
