/**
 * Wave I.9 — create wizard injects registry-loaded plugin (no sync Denali).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Wave I.9 — create wizard async plugin", () => {
  it("I.9-01 hook requires injected plugin; no sync resolve", () => {
    const source = readFileSync(join(WEB, "src/wizard/use-create-tour-wizard.ts"), "utf8");
    assert.match(source, /readonly plugin: WorkspacePlugin/);
    assert.doesNotMatch(source, /resolveWizardSyncWorkspacePlugin/);
    assert.match(source, /loadWizardWorkspacePlugin\(session\.pluginId\)/);
  });

  it("I.9-02 client loads plugin before mounting hook", () => {
    const source = readFileSync(join(WEB, "app/tours/new/create-tour-wizard-client.tsx"), "utf8");
    assert.match(source, /loadWizardWorkspacePlugin\(session\.pluginId\)/);
    assert.match(source, /useOperatorCreateTourWizard\(\{ plugin, initialTemplateResponse \}/);
    assert.match(source, /useWorkspaceWizardTranslator\(session\.pluginId\)/);
    assert.match(source, /platformCreateTourDraftKey\(session\.pluginId\)/);
    assert.doesNotMatch(source, /useWorkspaceWizardTranslator\(\"denali\"\)/);
    assert.doesNotMatch(source, /platformCreateTourDraftKey\(\"denali\"\)/);
  });
});
