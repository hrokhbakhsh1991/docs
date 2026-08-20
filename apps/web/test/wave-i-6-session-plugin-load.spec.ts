/**
 * Wave I.6 — session.pluginId drives wizard async plugin load.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Wave I.6 — session plugin load", () => {
  it("I.6-01 create wizard loads with session.pluginId", () => {
    const source = readFileSync(join(WEB, "src/wizard/use-create-tour-wizard.ts"), "utf8");
    assert.match(source, /loadWizardWorkspacePlugin\(session\.pluginId\)/);
    assert.doesNotMatch(source, /loadWizardWorkspacePlugin\(\s*\)/);
  });

  it("I.6-02 flat-edit client loads + translates with session.pluginId", () => {
    const source = readFileSync(
      join(WEB, "app/(app)/tours/[id]/edit/flat-edit-page-client.tsx"),
      "utf8"
    );
    assert.match(source, /warmFlatEditOperatorShell\(session\.pluginId\)/);
    assert.match(source, /warmOperatorWizardShell\(pluginId\)/);
    assert.match(source, /useWorkspaceWizardTranslator\(session\.pluginId\)/);
    assert.doesNotMatch(source, /warmOperatorWizardShell\(\s*\)/);
    assert.doesNotMatch(source, /useWorkspaceWizardTranslator\(DENALI_PLUGIN_ID\)/);
    assert.doesNotMatch(source, /from \"@\/wizard\/denali\/workspace-plugin-id\"/);
  });

  it("I.6-03 effect deps include session.pluginId", () => {
    const source = readFileSync(
      join(WEB, "app/(app)/tours/[id]/edit/flat-edit-page-client.tsx"),
      "utf8"
    );
    assert.match(source, /}, \[session\.pluginId\]\);/);
  });
});
