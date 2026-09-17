import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  createExposureIntentRepository,
  resetExposureIntentRepositoryForTests,
} from "./create-exposure-intent-repository";

describe("InMemoryExposureIntentRepository", () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
    resetExposureIntentRepositoryForTests();
  });

  after(() => {
    resetExposureIntentRepositoryForTests();
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
  });

  it("upserts and reads workspace surface intents without Postgres", async () => {
    const repository = createExposureIntentRepository();
    const saved = await repository.upsert({
      tenantId: "00000000-0000-4000-8000-000000000003",
      workspaceType: "denali",
      profileId: "profile-public-list",
      entityType: "tour",
      surface: "public_list",
      audience: "public",
      trigger: "always",
      scope: { tourSurface: "public_list" },
      mode: "override_fields",
      selectedFieldIds: ["title"],
    });

    const loaded = await repository.findForContext({
      tenantId: "00000000-0000-4000-8000-000000000003",
      profileId: "profile-public-list",
      surface: "public_list",
      audience: "public",
      trigger: "always",
      scope: { tourSurface: "public_list" },
    });

    assert.equal(saved.mode, "override_fields");
    assert.deepEqual(saved.selectedFieldIds, ["title"]);
    assert.deepEqual(loaded?.selectedFieldIds, ["title"]);
  });
});
