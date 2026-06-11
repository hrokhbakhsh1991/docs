/**
 * Phase 11.0 — operator smoke reference catalog seed
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { getSettingsResourcesRepository } from "../src/settings/create-settings-resources-repository";
import {
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
});
