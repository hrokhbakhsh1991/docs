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
    const themes = await repo.listTourThemes(DENALI_SMOKE_TENANT_ID);
    const activeCount = destinations.filter((item) => item.isActive).length;
    assert.ok(
      activeCount >= 3,
      `equipment=${equipment.length} regions=${regions.length} destinations=${activeCount} names=${destinations.map((item) => item.name).join(", ")}`
    );
    assert.equal(equipment[0]?.name, "عصای کوهنوردی");
    assert.equal(themes[0]?.name, "کوهستان");
  });

  it("API-11.0-04 re-upserts Denali club FA catalog names when equipment already exists", async () => {
    resetSettingsResourcesRepositorySingletonForTests();
    const repo = getSettingsResourcesRepository();
    await seedOperatorSmokeCatalog(repo, { tenantId: DENALI_SMOKE_TENANT_ID });
    const first = await repo.listEquipment(DENALI_SMOKE_TENANT_ID);
    assert.equal(first[0]?.name, "عصای کوهنوردی");
    // Mutate to English then re-seed — ensure path must restore FA labels.
    await repo.seedEquipment({
      ...first[0]!,
      name: "Smoke Trekking Poles",
    });
    await seedOperatorSmokeCatalog(repo, { tenantId: DENALI_SMOKE_TENANT_ID });
    const equipment = await repo.listEquipment(DENALI_SMOKE_TENANT_ID);
    const themes = await repo.listTourThemes(DENALI_SMOKE_TENANT_ID);
    assert.equal(equipment[0]?.name, "عصای کوهنوردی");
    assert.equal(themes[0]?.name, "کوهستان");
  });
});
