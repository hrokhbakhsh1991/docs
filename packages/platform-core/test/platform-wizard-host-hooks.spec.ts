import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPlatformWizardHostHooks } from "../src/host/create-platform-wizard-host-hooks";
import { createStarterWorkspacePlugin } from "@app-tour/workspace-sdk/plugin";
import { workspaceThemePresets } from "@app-tour/workspace-sdk/theme";

describe("platform-wizard-host-hooks.spec.ts (SDK-12.8-01)", () => {
  it("exports createPlatformWizardHostHooks with step validation enabled", () => {
    const hooks = createPlatformWizardHostHooks({ dimensions: { variant: "default" } });
    assert.equal(hooks.usesStepValidation, true);
    assert.equal(typeof hooks.validateDraftSync, "function");
    assert.equal(typeof hooks.resolveMatrixDimensionsFromDraft, "function");
  });

  it("resolveMatrixDimensionsFromDraft returns fixed dimensions", () => {
    const hooks = createPlatformWizardHostHooks({ dimensions: { tourType: "city" } });
    assert.deepEqual(hooks.resolveMatrixDimensionsFromDraft?.({}, null), { tourType: "city" });
  });

  it("validateDraftSync rejects empty starter draft", () => {
    const plugin = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
    const hooks = createPlatformWizardHostHooks({ dimensions: { variant: "default" } });
    const result = hooks.validateDraftSync?.({
      plugin,
      draft: { data: { basics: {}, details: {} } },
      rulesModule: null,
      tenantId: "platform-host-hooks-tenant",
    });
    assert.ok(result);
    assert.equal(result.ok, false);
    assert.ok(result.violations.length > 0);
  });

  it("validateDraftSync accepts minimal valid starter draft", () => {
    const plugin = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
    const hooks = createPlatformWizardHostHooks({ dimensions: { variant: "default" } });
    const result = hooks.validateDraftSync?.({
      plugin,
      draft: {
        data: {
          basics: { title: "Starter tour", featured: false },
          details: { summary: "Summary", status: "draft" },
        },
      },
      rulesModule: null,
      tenantId: "platform-host-hooks-tenant",
    });
    assert.ok(result);
    assert.equal(result.ok, true, JSON.stringify(result.violations));
  });
});
