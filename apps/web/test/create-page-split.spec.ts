import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROUTER = join(WEB_ROOT, "app/tours/new/new-tour-wizard-client.tsx");
const DENALI_CLIENT = join(WEB_ROOT, "app/tours/new/denali-create-tour-wizard-client.tsx");
const DENALI_HOOK = join(WEB_ROOT, "src/wizard/use-denali-create-tour-wizard.ts");
const WORKSPACE_SHELL = join(WEB_ROOT, "src/wizard/workspace-create-tour-shell.tsx");

describe("create-page-split.spec.ts (P13-4)", () => {
  it("P13-4-01 router delegates by pluginId without Denali imports", () => {
    const router = readFileSync(ROUTER, "utf8");
    assert.equal(router.split("\n").length < 35, true);
    assert.match(router, /DenaliCreateTourWizardClient/);
    assert.match(router, /WorkspaceCreateTourWizardShell/);
    assert.match(router, /initialTemplateResponse/);
    assert.doesNotMatch(router, /@app-tour\/workspace-denali/);
  });

  it("P13-4-02 denali client is slim shell over orchestration hook", () => {
    const denali = readFileSync(DENALI_CLIENT, "utf8");
    const hook = readFileSync(DENALI_HOOK, "utf8");
    assert.doesNotMatch(denali, /\bisDenali\b/);
    assert.match(denali, /useDenaliCreateTourWizard/);
    assert.match(denali, /DenaliCreateTourWizardView/);
    assert.match(hook, /createWizardAssetSessionId/);
    assert.match(hook, /prepareWizardDraftEnvelope/);
    assert.match(denali, /CreateTourWizardDenaliHeader/);
  });

  it("P13-4-03 workspace shell delegates to platform orchestrator", () => {
    const shell = readFileSync(WORKSPACE_SHELL, "utf8");
    assert.doesNotMatch(shell, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(shell, /useWorkspaceDraft/);
    assert.match(shell, /WorkspaceCreateTourWizardClient/);
  });
});
