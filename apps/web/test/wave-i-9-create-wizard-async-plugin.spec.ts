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
    const client = readFileSync(join(WEB, "app/tours/new/create-tour-wizard-client.tsx"), "utf8");
    const ready = readFileSync(
      join(WEB, "app/tours/new/create-tour-wizard-client-ready.tsx"),
      "utf8"
    );
    assert.match(client, /warmOperatorWizardShell\(session\.pluginId\)/);
    assert.match(client, /OperatorCreateTourWizardClientReady/);
    assert.match(ready, /useOperatorCreateTourWizard\(\{\s*plugin,/);
    assert.match(ready, /useWorkspaceWizardTranslator\(session\.pluginId\)/);
    assert.match(ready, /platformCreateTourDraftKey\(session\.pluginId\)/);
    assert.doesNotMatch(ready, /useWorkspaceWizardTranslator\(\"denali\"\)/);
    assert.doesNotMatch(ready, /platformCreateTourDraftKey\(\"denali\"\)/);
  });
});
