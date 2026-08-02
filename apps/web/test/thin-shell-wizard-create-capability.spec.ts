/**
 * Thin Shell Phase 4bg — wizardCreate capability + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";
import { resolveWizardCreateCapability } from "@app-tour/workspace-sdk";

import {
  ensureWizardCreate,
  isWizardExtendedCreatePlugin,
  seedWizardCreate,
} from "../src/workspace/wizard-create-registry";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-wizard-create-capability — Phase 4bg", () => {
  it("TS-4BG-01 denali publishes capabilities.wizardCreate.extendedChrome", () => {
    const cap = resolveWizardCreateCapability(getDenaliPlugin());
    assert.ok(cap);
    assert.equal(cap.extendedChrome, true);
  });

  it("TS-4BG-02 binder deleted; ensure/seed warm sync helpers", async () => {
    assert.equal(
      existsSync(resolve(WEB_ROOT, "src/bootstrap/wizard-create-bindings.generated.ts")),
      false
    );
    const registry = readFileSync(
      resolve(WEB_ROOT, "src/workspace/wizard-create-registry.ts"),
      "utf8"
    );
    assert.match(registry, /resolveWizardCreateCapability/);
    assert.match(registry, /loadBootstrapWorkspacePlugin/);
    assert.doesNotMatch(registry, /wizard-create-bindings/);

    assert.equal(await ensureWizardCreate("denali").then((e) => e.extendedChrome), true);
    assert.equal(isWizardExtendedCreatePlugin("denali"), true);
    assert.equal(await ensureWizardCreate("urban").then((e) => e.extendedChrome), false);
    assert.equal(isWizardExtendedCreatePlugin("urban"), false);

    seedWizardCreate("fixture-seed", { extendedChrome: true });
    assert.equal(isWizardExtendedCreatePlugin("fixture-seed"), true);
  });

  it("TS-4BG-03 layouts/shells wire ensure + seed", () => {
    const layout = readFileSync(resolve(WEB_ROOT, "app/(app)/layout.tsx"), "utf8");
    assert.match(layout, /ensureWizardCreate/);
    assert.match(layout, /wizardCreate=\{wizardCreate\}/);

    const tours = readFileSync(resolve(WEB_ROOT, "src/shell/tours-wizard-layout.tsx"), "utf8");
    assert.match(tours, /ensureWizardCreate/);

    const operatorShell = readFileSync(
      resolve(WEB_ROOT, "src/admin/shell/operator-shell.tsx"),
      "utf8"
    );
    assert.match(operatorShell, /seedWizardCreate/);

    const bridge = readFileSync(resolve(WEB_ROOT, "src/shell/wizard-bridge-shell.tsx"), "utf8");
    assert.match(bridge, /seedWizardCreate/);
  });
});
