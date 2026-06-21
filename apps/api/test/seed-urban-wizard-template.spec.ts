/**
 * P15-P-D0 — urban wizard_template dev seed
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { URBAN_SMOKE_TENANT_ID } from "@app-tour/workspace-urban";

import { getSettingsConfigRepository } from "../src/settings/create-settings-config-repository";
import { seedWorkspaceWizardTemplateForTenant } from "../src/settings/seed-workspace-wizard-template";
import { installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type WizardTemplatePayload = {
  published?: boolean;
  steps?: { stepId: string; fields: { canonicalPath: string }[] }[];
};

describe("seed-urban-wizard-template.spec.ts — P15-P-D0", () => {
  it("API-P15-D0-01 seeds published urban_tour + review wizard_template", async () => {
    await seedWorkspaceWizardTemplateForTenant(URBAN_SMOKE_TENANT_ID);

    const row = await getSettingsConfigRepository().get(
      URBAN_SMOKE_TENANT_ID,
      "wizard_template"
    );
    assert.ok(row);

    const payload = row.payload as WizardTemplatePayload;
    assert.equal(payload.published, true);
    assert.equal(payload.steps?.length, 2);
    assert.equal(payload.steps?.[0]?.stepId, "urban_tour");
    assert.equal(payload.steps?.[1]?.stepId, "review");
    assert.equal(payload.steps?.[0]?.fields[0]?.canonicalPath, "tour.title");
  });

  it("API-P15-D0-02 skips re-seed when published template already exists", async () => {
    await seedWorkspaceWizardTemplateForTenant(URBAN_SMOKE_TENANT_ID);
    const repo = getSettingsConfigRepository();
    const before = await repo.get(URBAN_SMOKE_TENANT_ID, "wizard_template");
    assert.ok(before);

    await seedWorkspaceWizardTemplateForTenant(URBAN_SMOKE_TENANT_ID);
    const after = await repo.get(URBAN_SMOKE_TENANT_ID, "wizard_template");
    assert.deepEqual(after?.payload, before.payload);
    assert.equal(after?.updatedAt, before.updatedAt);
  });
});
