import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROUTER = join(WEB_ROOT, "app/tours/new/new-tour-wizard-client.tsx");
const DENALI_CLIENT = join(WEB_ROOT, "app/tours/new/denali-create-tour-wizard-client.tsx");
const WORKSPACE_SHELL = join(WEB_ROOT, "src/wizard/workspace-create-tour-shell.tsx");

describe("create-page-split.spec.ts (P13-4)", () => {
  it("P13-4-01 router delegates by pluginId without Denali imports", () => {
    const router = readFileSync(ROUTER, "utf8");
    assert.equal(router.split("\n").length < 30, true);
    assert.match(router, /DenaliCreateTourWizardClient/);
    assert.match(router, /WorkspaceCreateTourWizardShell/);
    assert.doesNotMatch(router, /@app-tour\/workspace-denali/);
  });

  it("P13-4-02 denali client has no isDenali branches", () => {
    const denali = readFileSync(DENALI_CLIENT, "utf8");
    assert.doesNotMatch(denali, /\bisDenali\b/);
    assert.match(denali, /createWizardAssetSessionId/);
    assert.match(denali, /prepareWizardDraftEnvelope/);
    assert.match(denali, /DraftSyncChrome/);
  });

  it("P13-4-03 workspace shell avoids Denali draft packages", () => {
    const shell = readFileSync(WORKSPACE_SHELL, "utf8");
    assert.doesNotMatch(shell, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(shell, /useWorkspaceDraft/);
    assert.match(shell, /WorkspaceWizardHost/);
  });
});
