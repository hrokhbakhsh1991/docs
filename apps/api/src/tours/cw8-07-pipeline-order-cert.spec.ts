/**
 * CW8-07 — pipeline order certification + capability registry stability.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import {
  createCanonicalDocument,
  createNoopWorkspaceValidationHooks,
  createStarterWorkspacePlugin,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";

import { runWorkspaceValidationPipeline } from "./run-workspace-validation-pipeline.ts";
import { WORKSPACE_CAPABILITY_VALIDATORS } from "./workspace-capability-validation-bindings.generated.ts";

function starterPlugin(): WorkspacePlugin {
  return createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
}

function pluginWithHooks(
  hooks: ReturnType<typeof createNoopWorkspaceValidationHooks>
): WorkspacePlugin {
  const base = starterPlugin();
  return { ...base, validation: hooks };
}

describe("cw8-07-pipeline-order-cert", () => {
  it("exports pipeline stages in shared → capability → policy order", () => {
    const source = readFileSync(
      new URL("./run-workspace-validation-pipeline.ts", import.meta.url),
      { encoding: "utf8" }
    );
    const stagesIndex = source.indexOf("const PIPELINE_STAGES");
    assert.ok(stagesIndex >= 0);
    const stagesBlock = source.slice(stagesIndex, stagesIndex + 400);
    const sharedIndex = stagesBlock.indexOf("runSharedValidationStage");
    const capabilityIndex = stagesBlock.indexOf("runCapabilityValidationStage");
    const policyIndex = stagesBlock.indexOf("runWorkspacePolicyValidationStage");
    assert.ok(sharedIndex >= 0 && capabilityIndex > sharedIndex && policyIndex > capabilityIndex);
  });

  it("short-circuits on shared stage before policy hooks run", () => {
    let policyCalled = false;
    const plugin = pluginWithHooks({
      checkCapacity: () => {
        policyCalled = true;
        return { code: "POLICY_FAIL", message: "should not run" };
      },
      checkTripDetails: () => null,
    });
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: { basics: { title: "" }, details: { summary: "ok" } },
    });
    const engine = PlatformWizardEngine.create(plugin);
    const violation = runWorkspaceValidationPipeline({
      plugin,
      document,
      workspaceType: "starter",
      tenantId: "cw8-07-tenant",
      validationMode: "draft",
      validationVariant: "default",
      dimensions: { variant: "default" },
      engine,
    });
    assert.equal(violation?.stage, "shared");
    assert.equal(policyCalled, false);
  });

  it("capability validator registry is lexicographically stable", () => {
    const ids = WORKSPACE_CAPABILITY_VALIDATORS.map((row) => row.capabilityId);
    const sorted = [...ids].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(ids, sorted);
    assert.ok(ids.includes("workspaceTransport"));
  });

  it("pipeline runner has no workspace-id host branching", () => {
    const source = readFileSync(
      new URL("./run-workspace-validation-pipeline.ts", import.meta.url),
      { encoding: "utf8" }
    );
    assert.equal(source.includes('workspaceType === "denali"'), false);
    assert.equal(source.includes('workspaceType === "urban"'), false);
  });
});
