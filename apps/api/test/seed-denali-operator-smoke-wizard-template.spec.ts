/**
 * Denali operator-smoke wizard_template bootstrap — tenant …014
 * Authority: docs/dev/denali-operator-smoke-wizard-template-seed.mdoc
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSettingsConfigRepository } from "../src/settings/create-settings-config-repository";
import { OPERATOR_SMOKE_TENANT_ID } from "../src/settings/seed-operator-smoke-catalog";
import { seedWorkspaceWizardTemplateForTenant } from "../src/settings/seed-workspace-wizard-template";
import { WORKSPACE_DEV_WIZARD_TEMPLATE_BINDINGS } from "../src/settings/workspace-dev-bootstrap-bindings.generated";
import { installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type WizardTemplatePayload = {
  published?: boolean;
  steps?: { stepId: string; fields: { canonicalPath: string }[] }[];
};

describe("seed-denali-operator-smoke-wizard-template.spec.ts", () => {
  it("bindings include operator-smoke tenant on denali wizardTemplate allowlist", () => {
    const denali = WORKSPACE_DEV_WIZARD_TEMPLATE_BINDINGS.find((b) => b.workspaceId === "denali");
    assert.ok(denali);
    assert.ok(
      (denali.tenantIds as readonly string[]).includes(OPERATOR_SMOKE_TENANT_ID),
      "devBootstrap.wizardTemplate.tenantIds must include OPERATOR_SMOKE_TENANT_ID (…014)"
    );
  });

  it("seeds published denali wizard_template for operator-smoke tenant …014", async () => {
    await seedWorkspaceWizardTemplateForTenant(OPERATOR_SMOKE_TENANT_ID);

    const row = await getSettingsConfigRepository().get(
      OPERATOR_SMOKE_TENANT_ID,
      "wizard_template"
    );
    assert.ok(row);

    const payload = row.payload as WizardTemplatePayload;
    assert.equal(payload.published, true);
    assert.ok((payload.steps?.length ?? 0) >= 2);
    assert.equal(payload.steps?.[0]?.stepId, "denali_basic");
    assert.ok(
      payload.steps?.some((step) => step.stepId === "denali_photos"),
      "published template must include denali_photos step"
    );
    // Tenant payload omits rail `review` (added by host chrome) — see buildDenaliTenantWizardTemplatePayload.
    assert.equal(payload.steps?.[0]?.fields[0]?.canonicalPath, "category");
    assert.equal(payload.steps?.length, 6);  });

  it("skips re-seed when published operator-smoke template already exists", async () => {
    await seedWorkspaceWizardTemplateForTenant(OPERATOR_SMOKE_TENANT_ID);
    const repo = getSettingsConfigRepository();
    const before = await repo.get(OPERATOR_SMOKE_TENANT_ID, "wizard_template");
    assert.ok(before);

    await seedWorkspaceWizardTemplateForTenant(OPERATOR_SMOKE_TENANT_ID);
    const after = await repo.get(OPERATOR_SMOKE_TENANT_ID, "wizard_template");
    assert.ok(after);
    assert.equal(after.updatedAt, before.updatedAt);
    assert.deepEqual(after.payload, before.payload);
  });
});
