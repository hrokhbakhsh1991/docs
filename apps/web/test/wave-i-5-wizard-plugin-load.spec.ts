/**
 * Wave I.5 — neutral wizard plugin load/resolve names.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Wave I.5 — wizard plugin load", () => {
  it("I.5-01 resolve module lives at wizard root with neutral exports", () => {
    const path = join(WEB, "src/wizard/resolve-wizard-workspace-plugin.ts");
    assert.equal(existsSync(path), true);
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /resolveWizardSyncWorkspacePlugin/);
    assert.doesNotMatch(source, /draft-shell-runtime/);
    assert.match(source, /export async function loadWizardWorkspacePlugin/);
    assert.doesNotMatch(source, /loadDenaliWorkspacePlugin|resolveDenaliSyncWorkspacePlugin/);
  });

  it("I.5-02 create + flat-edit use loadWizardWorkspacePlugin", () => {
    const create = readFileSync(join(WEB, "src/wizard/use-create-tour-wizard.ts"), "utf8");
    assert.match(create, /loadWizardWorkspacePlugin/);
    assert.doesNotMatch(create, /loadDenaliWorkspacePlugin|resolveDenaliSyncWorkspacePlugin/);
    assert.doesNotMatch(create, /resolveWizardSyncWorkspacePlugin/);
    assert.doesNotMatch(create, /denali\/resolve-sync-workspace-plugin/);

    const flat = readFileSync(
      join(WEB, "app/(app)/tours/[id]/edit/flat-edit-page-client.tsx"),
      "utf8"
    );
    assert.match(flat, /warmOperatorWizardShell/);
    assert.doesNotMatch(flat, /loadDenaliWorkspacePlugin/);
  });

  it("I.5-03 denali firewall no longer hosts resolve-sync", () => {
    assert.equal(
      existsSync(join(WEB, "src/wizard/denali/resolve-sync-workspace-plugin.ts")),
      false
    );
  });
});
