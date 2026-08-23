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

import {
  runCapabilityValidationStage,
  runLegacyPostEngineValidation,
  runSharedValidationStage,
  runWorkspacePolicyValidationStage,
  runWorkspaceValidationPipeline,
} from "./run-workspace-validation-pipeline.js";
import { WORKSPACE_CAPABILITY_VALIDATORS } from "./workspace-capability-validation-bindings.generated.js";

function starterPlugin(): WorkspacePlugin {
  return createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
}

function pluginWithHooks(
  hooks: ReturnType<typeof createNoopWorkspaceValidationHooks>,
  extraFields: WorkspacePlugin["fieldRegistry"]["fields"] = []
): WorkspacePlugin {
  const base = starterPlugin();
  return {
    ...base,
    fieldRegistry: {
      version: 1,
      fields: [...base.fieldRegistry.fields, ...extraFields],
    },
    validation: hooks,
  };
}

function starterDocument() {
  return createCanonicalDocument({
    schemaVersion: 1,
    roots: ["basics", "details"],
    data: { basics: { title: "Tour" }, details: { summary: "ok" } },
  });
}

function pipelineInput(
  plugin: WorkspacePlugin,
  document = starterDocument(),
  overrides: Partial<Parameters<typeof runWorkspaceValidationPipeline>[0]> = {}
) {
  const engine = PlatformWizardEngine.create(plugin);
  return {
    plugin,
    document,
    workspaceType: "starter",
    tenantId: "pipeline-test-tenant",
    validationMode: "draft" as const,
    validationVariant: "default" as const,
    dimensions: { variant: "default" },
    engine,
    ...overrides,
  };
}

describe("runWorkspaceValidationPipeline", () => {
  it("keeps the pipeline runner workspace-generic", () => {
    const source = readFileSync(
      new URL("./run-workspace-validation-pipeline.ts", import.meta.url),
      { encoding: "utf8" }
    );
    assert.equal(source.includes("denali"), false);
    assert.equal(source.includes("urban"), false);
    assert.equal(source.includes('workspaceType ==='), false);
  });

  it("runs shared → capability → policy in order and short-circuits on first violation", () => {
    const calls: string[] = [];
    const plugin = pluginWithHooks({
      checkCapacity: () => {
        calls.push("policy-capacity");
        return { code: "POLICY_FAIL", message: "policy blocked" };
      },
      checkTripDetails: () => null,
    });
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: { basics: { title: "", capacity: 5 }, details: { summary: "ok" } },
    });
    const input = pipelineInput(plugin, document);
    const violation = runWorkspaceValidationPipeline(input);
    assert.equal(violation?.stage, "shared");
    assert.ok(violation?.message.length);
    assert.deepEqual(calls, []);
  });

  it("capability stage short-circuits on stale catalog refs before policy", () => {
    let policyCalled = false;
    const plugin = pluginWithHooks({
      checkCapacity: () => {
        policyCalled = true;
        return { code: "POLICY_FAIL", message: "should not run" };
      },
      checkTripDetails: () => null,
    });
    const violation = runCapabilityValidationStage({
      plugin,
      document: createCanonicalDocument({
        schemaVersion: 1,
        roots: ["program"],
        data: { program: { themeIds: ["missing-theme"] } },
      }),
      workspaceType: "starter",
      tenantId: "tenant",
      validationMode: "publish",
      validationVariant: "default",
      dimensions: { variant: "default" },
      catalogRefAllowlists: {
        activeThemeIds: ["known-theme"],
        selectableLeaderIds: [],
      },
    });
    assert.equal(violation?.stage, "capability");
    assert.equal(violation?.code, "CATALOG_REF_INTEGRITY_FAILED");
    assert.equal(policyCalled, false);
  });

  it("treats empty capability bindings as skip (no error)", () => {
    assert.equal(WORKSPACE_CAPABILITY_VALIDATORS.length, 0);
    const plugin = starterPlugin();
    const violation = runCapabilityValidationStage({
      plugin,
      document: starterDocument(),
      workspaceType: "starter",
      tenantId: "tenant",
      validationMode: "draft",
      validationVariant: "default",
      dimensions: { variant: "default" },
    });
    assert.equal(violation, null);
  });

  it("runs policy hooks after capability stage passes", () => {
    let seenCapacity = -1;
    const plugin = pluginWithHooks(
      {
        checkCapacity: (capacity) => {
          seenCapacity = capacity;
          return { code: "CAPACITY_EXCEEDED", message: "too many seats" };
        },
        checkTripDetails: () => null,
      },
      [
        {
          id: "basics.capacity",
          canonicalPath: "basics.capacity",
          stepId: "basics",
          kind: "number",
          required: false,
          tags: ["capacity"],
        },
      ]
    );
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: { basics: { title: "Tour", capacity: 42 }, details: { summary: "ok" } },
    });
    const violation = runWorkspacePolicyValidationStage({
      plugin,
      document,
      workspaceType: "starter",
      tenantId: "tenant",
      validationMode: "draft",
      validationVariant: "default",
      dimensions: { variant: "default" },
    });
    assert.equal(seenCapacity, 42);
    assert.equal(violation?.stage, "workspacePolicy");
    assert.equal(violation?.code, "CAPACITY_EXCEEDED");
  });

  it("skips validatePublishReadiness in draft mode", () => {
    const plugin = starterPlugin();
    const violation = runWorkspacePolicyValidationStage({
      plugin,
      document: starterDocument(),
      workspaceType: "starter",
      tenantId: "tenant",
      validationMode: "draft",
      validationVariant: "default",
      dimensions: { variant: "default" },
    });
    assert.equal(violation, null);
  });

  it("shared stage returns joined engine messages for legacy throw parity", () => {
    const plugin = starterPlugin();
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: { basics: { title: "" }, details: { summary: "ok" } },
    });
    const violation = runSharedValidationStage(pipelineInput(plugin, document));
    assert.equal(violation?.stage, "shared");
    assert.match(violation?.message ?? "", /title/i);
  });

  it("legacy post-engine path matches pre-pipeline ordering (hooks → publish → catalog)", () => {
    const stages: string[] = [];
    const plugin = pluginWithHooks(
      {
        checkCapacity: () => {
          stages.push("hooks");
          return null;
        },
        checkTripDetails: () => null,
      },
      [
        {
          id: "basics.capacity",
          canonicalPath: "basics.capacity",
          stepId: "basics",
          kind: "number",
          required: false,
          tags: ["capacity"],
        },
      ]
    );
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details", "program"],
      data: {
        basics: { title: "Tour", capacity: 5 },
        details: { summary: "ok" },
        program: { themeIds: ["stale"] },
      },
    });
    const violation = runLegacyPostEngineValidation(
      plugin,
      document,
      "publish",
      "starter",
      { activeThemeIds: ["fresh"], selectableLeaderIds: [] }
    );
    assert.equal(violation?.code, "CATALOG_REF_INTEGRITY_FAILED");
    assert.deepEqual(stages, ["hooks"]);
  });
});
