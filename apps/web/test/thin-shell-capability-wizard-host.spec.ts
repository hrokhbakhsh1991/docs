import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-cloud/workspace-denali";
import { resolveWizardHostCapability } from "@app-cloud/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-capability-wizard-host — Phase 4r", () => {
  it("TS-4R-01 denali dual-publishes capabilities.wizardHost === top-level wizardHost", () => {
    const plugin = getDenaliPlugin();
    assert.ok(plugin.wizardHost);
    assert.ok(plugin.capabilities?.wizardHost);
    assert.equal(plugin.capabilities?.wizardHost, plugin.wizardHost);
    assert.equal(resolveWizardHostCapability(plugin), plugin.capabilities?.wizardHost);
  });

  it("TS-4R-02 warmOperatorWizardShell + create/edit warm paths call ensureWizardHostReady", () => {
    const warm = readFileSync(
      resolve(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"),
      "utf8"
    );
    assert.match(warm, /ensureWizardHostReady/);
    assert.doesNotMatch(warm, /wizardHost\?\.ensureReady/);

    const createReady = readFileSync(
      resolve(WEB_ROOT, "app/tours/new/create-tour-wizard-client-ready.tsx"),
      "utf8"
    );
    assert.match(createReady, /ensureWizardHostReady/);

    const edit = readFileSync(
      resolve(WEB_ROOT, "app/(app)/tours/[id]/edit/tour-edit-page-client.tsx"),
      "utf8"
    );
    assert.match(edit, /ensureWizardHostReady/);
  });
});
