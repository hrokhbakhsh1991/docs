import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSettingsConfigRepository } from "../src/settings/create-settings-config-repository.ts";
import { seedWorkspaceWizardTemplateForWorkspaceType } from "../src/settings/seed-workspace-wizard-template.ts";
import { installMemoryStorageDriverForDescribe } from "./test-helpers.ts";

installMemoryStorageDriverForDescribe();

type WizardTemplatePayload = {
  published?: boolean;
  steps?: { stepId: string }[];
};

describe("P1-N-052: seedWorkspaceWizardTemplateForWorkspaceType", () => {
  it("should seed denali wizard with 6+ published steps", async () => {
    const testTenantId = "test-tenant-denali";

    await seedWorkspaceWizardTemplateForWorkspaceType(testTenantId, "denali");

    const row = await getSettingsConfigRepository().get(testTenantId, "wizard_template");
    assert.ok(row, "wizard_template should exist");

    const payload = row.payload as WizardTemplatePayload;
    assert.strictEqual(payload.published, true, "template should be published");
    assert.ok(payload.steps && payload.steps.length >= 6, "denali should have 6+ steps");
  });

  it("should be idempotent and skip re-seed when published template exists", async () => {
    const testTenantId = "test-tenant-idempotent";

    // First seed
    await seedWorkspaceWizardTemplateForWorkspaceType(testTenantId, "denali");
    const repo = getSettingsConfigRepository();
    const before = await repo.get(testTenantId, "wizard_template");
    assert.ok(before, "first seed should create template");

    // Second seed (should skip)
    await seedWorkspaceWizardTemplateForWorkspaceType(testTenantId, "denali");
    const after = await repo.get(testTenantId, "wizard_template");

    assert.deepEqual(after?.payload, before.payload, "payload should not change");
    assert.strictEqual(after?.updatedAt, before.updatedAt, "updatedAt should not change");
  });
});

// Made with Bob
