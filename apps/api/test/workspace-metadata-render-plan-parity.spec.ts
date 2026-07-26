import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import { denaliPluginForWizardEngine } from "@app-tour/workspace-denali";

import { adaptMetadataPayloadToWorkspacePlugin } from "../src/workspace-metadata/metadata-plugin-adapter.ts";
import { resolveWorkspacePluginForType } from "../src/workspace/resolve-workspace-plugin.ts";
import { loadDenaliSeedExport } from "./lib/workspace-metadata-parity-helpers.ts";

const DENALI_RULE_CONTEXT = {
  tenantId: "render-plan-parity",
  dimensions: { category: "mountain", duration: "single_day" },
} as const;

export function buildParityRenderPlans(): {
  readonly packagePlan: ReturnType<PlatformWizardEngine["buildRenderPlan"]>;
  readonly metadataPlan: ReturnType<PlatformWizardEngine["buildRenderPlan"]>;
  readonly seedPayload: ReturnType<typeof loadDenaliSeedExport>["payload"];
} {
  const packagePlugin = await resolveWorkspacePluginForType("denali");
  const seed = loadDenaliSeedExport();
  const metadataPlugin = adaptMetadataPayloadToWorkspacePlugin(seed.payload, packagePlugin);

  const packageEngine = PlatformWizardEngine.create(denaliPluginForWizardEngine(packagePlugin));
  const metadataEngine = PlatformWizardEngine.create(denaliPluginForWizardEngine(metadataPlugin));

  return {
    packagePlan: packageEngine.buildRenderPlan(DENALI_RULE_CONTEXT),
    metadataPlan: metadataEngine.buildRenderPlan(DENALI_RULE_CONTEXT),
    seedPayload: seed.payload,
  };
}

function visibleFieldIds(plan: ReturnType<PlatformWizardEngine["buildRenderPlan"]>): readonly (readonly string[])[] {
  return plan.map((step) => step.fields.map((field) => field.fieldId));
}

function compositeIds(plan: ReturnType<PlatformWizardEngine["buildRenderPlan"]>): readonly string[] {
  const ids: string[] = [];
  for (const step of plan) {
    for (const field of step.fields) {
      const compositeId = field.uiHints?.compositeId;
      if (compositeId) {
        ids.push(compositeId);
      }
    }
  }
  return ids;
}

describe("workspace-metadata-render-plan-parity", () => {
  it("RP-01 same total visible field count per step", async () => {
    const { packagePlan, metadataPlan } = buildParityRenderPlans();
    assert.equal(packagePlan.length, metadataPlan.length);
    for (let index = 0; index < packagePlan.length; index += 1) {
      assert.equal(packagePlan[index]?.fields.length, metadataPlan[index]?.fields.length);
    }
  });

  it("RP-02 same ordered fieldId list per step", async () => {
    const { packagePlan, metadataPlan } = buildParityRenderPlans();
    assert.deepEqual(visibleFieldIds(metadataPlan), visibleFieldIds(packagePlan));
  });

  it("RP-03 same uiHints.compositeId for composite fields", async () => {
    const { packagePlan, metadataPlan } = buildParityRenderPlans();
    assert.deepEqual(compositeIds(metadataPlan), compositeIds(packagePlan));
    assert.ok(compositeIds(packagePlan).some((id) => id.startsWith("denali.")));
  });

  it("RP-04 denali seed retains denali.* composite ids", async () => {
    const { seedPayload } = buildParityRenderPlans();
    const compositeIdsInSeed = seedPayload.fieldRegistry.fields
      .filter((field) => field.kind === "composite" || field.id !== field.canonicalPath)
      .map((field) => field.id);
    assert.ok(compositeIdsInSeed.some((id) => id.startsWith("denali.")));
    assert.ok(!compositeIdsInSeed.some((id) => id.startsWith("platform.")));
  });
});
