/**
 * Thin Shell Phase 4bv — capability bag consolidation map (doc-only; no SDK fold).
 * @see docs/dev/thin-shell-capability-bag-consolidation.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");

/** As-built fine-grained slots — must match WorkspacePluginCapabilities + consolidation doc. */
const FINE_GRAINED_SLOTS = Object.freeze([
  "wizardHost",
  "hostProbe",
  "draftShell",
  "createChrome",
  "flatEditChrome",
  "createView",
  "flatEditForm",
  "flatEditPage",
  "templateGate",
  "operatorUi",
  "tourActionSubmit",
  "labels",
  "wizardSurfaces",
  "templatePreset",
  "settingsHubFallback",
  "templateEditor",
  "tourListCategory",
  "settingsDestination",
  "settingsEquipmentUi",
  "settingsExposureSurfacesUi",
  "operatorShellNav",
  "financeNav",
  "financeOps",
  "bookingOps",
  "wizardCreate",
]);

describe("thin-shell-capability-bag-consolidation — Phase 4bv", () => {
  it("TS-4BV-01 consolidation map doc locks inventory + fold sketch + no-fold rule", () => {
    const doc = readFileSync(
      resolve(REPO_ROOT, "docs/dev/thin-shell-capability-bag-consolidation.mdoc"),
      "utf8"
    );
    assert.match(doc, /No SDK type fold/);
    assert.match(doc, /tourCreation/);
    assert.match(doc, /Architect YES/);
    for (const slot of FINE_GRAINED_SLOTS) {
      assert.match(doc, new RegExp(`\`${slot}\``));
    }
  });

  it("TS-4BV-02 SDK WorkspacePluginCapabilities still declares all fine-grained slots", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "packages/workspace-sdk/src/plugin/workspace-plugin-capabilities.ts"
      ),
      "utf8"
    );
    assert.match(src, /export type WorkspacePluginCapabilities\s*=\s*\{/);
    for (const slot of FINE_GRAINED_SLOTS) {
      assert.match(src, new RegExp(`readonly ${slot}\\?:`));
    }
    // Coarse domains must not have been sneak-folded onto the live type yet.
    assert.doesNotMatch(src, /readonly (?:tourCreation|settings|navigation|ops|forms)\?:/);
  });

  it("TS-4BV-03 fine-grained slot count locked at 25", () => {
    assert.equal(FINE_GRAINED_SLOTS.length, 25);
    const unique = new Set(FINE_GRAINED_SLOTS);
    assert.equal(unique.size, 25);
  });

  it("TS-4BV-04 remediation + SDK contracts reference 4bv map", () => {
    const remediation = readFileSync(
      resolve(REPO_ROOT, "docs/dev/saas-platform-remediation.mdoc"),
      "utf8"
    );
    assert.match(remediation, /Phase 4bv/);
    assert.match(remediation, /thin-shell-capability-bag-consolidation\.mdoc/);

    const contracts = readFileSync(
      resolve(REPO_ROOT, "packages/workspace-sdk/SDK_CONTRACTS.md"),
      "utf8"
    );
    assert.match(contracts, /Capability-bag consolidation map \(Phase 4bv\)/);
  });
});
