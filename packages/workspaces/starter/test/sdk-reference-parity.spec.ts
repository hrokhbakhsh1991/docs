import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin as sdkReferencePlugin } from "@app-tour/workspace-sdk";

import { getStarterWorkspacePlugin } from "../src/starter.plugin";

/**
 * workspace-sdk keeps a reference export for packages that cannot import workspaces/* (depcruise).
 * workspace-starter extends that plugin with platform wizard host hooks (Phase 12.8).
 */
describe("sdk reference parity", () => {
  it("matches sdk reference metadata and adds wizardHost hooks", () => {
    const sdk = sdkReferencePlugin();
    const starter = getStarterWorkspacePlugin();

    assert.equal(starter.id, sdk.id);
    assert.equal(starter.version, sdk.version);
    assert.equal(starter.contractVersion, sdk.contractVersion);
    assert.deepEqual(starter.supportedWorkspaceTypes, sdk.supportedWorkspaceTypes);
    assert.deepEqual(starter.fieldRegistry, sdk.fieldRegistry);
    assert.deepEqual(starter.ruleSet, sdk.ruleSet);
    assert.deepEqual(starter.wizard, sdk.wizard);
    assert.deepEqual(starter.lifecycle, sdk.lifecycle);
    assert.deepEqual(starter.theme, sdk.theme);

    assert.ok(starter.wizardHost);
    assert.equal(typeof starter.wizardHost.validateDraftSync, "function");
    assert.equal(starter.wizardHost.usesStepValidation, true);
  });
});
