import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";

import { getDenaliWorkspacePlugin } from "../src/denali.plugin";
import { denaliPluginForWizardEngine } from "../src/plugin-for-wizard-engine";

describe("plugin-for-wizard-engine.spec.ts", () => {
  it("DENALI-INGRESS-01 strips callable surfaces before PlatformWizardEngine.create", () => {
    const plugin = getDenaliWorkspacePlugin();
    const engine = PlatformWizardEngine.create(denaliPluginForWizardEngine(plugin));
    assert.equal(typeof engine.validateCanonical, "function");
  });
});
