/**
 * Create warm ownership — flat-edit UI surfaces stay off wizardHost.ensureReady.
 * Static shell/wiring guards (A/B). Runtime ensureReady matrix lives in
 * `packages/workspaces/denali/test/wizard-create-warm-ownership.spec.ts`.
 * @see docs/dev/wizard-create-warm-ownership.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");
const DENALI_HOOKS = resolve(
  REPO_ROOT,
  "packages/workspaces/denali/src/wizard/denali-wizard-host-hooks.ts"
);
const FLAT_EDIT_CLIENT = resolve(
  WEB_ROOT,
  "app/(app)/tours/[id]/edit/flat-edit-page-client.tsx"
);
const CREATE_CLIENT = resolve(WEB_ROOT, "app/tours/new/create-tour-wizard-client.tsx");

describe("wizard-create-warm-ownership (shell wiring)", () => {
  it("A) denali wizardHost.ensureReady source does not warm flat-edit UI surfaces", () => {
    const hooks = readFileSync(DENALI_HOOKS, "utf8");
    assert.doesNotMatch(hooks, /ensureWizardFlatEditChromePackageSurface/);
    assert.doesNotMatch(hooks, /ensureWizardFlatEditFormPackageSurface/);
    assert.doesNotMatch(hooks, /ensureWizardFlatEditPagePackageSurface/);
    assert.match(hooks, /ensureWizardCreateChromePackageSurface/);
    assert.match(hooks, /ensureWizardCreateViewPackageSurface/);
    assert.match(hooks, /ensureWizardHostAdapterSurface/);
  });

  it("A) create /tours/new client warms via shell only (no flat-edit ensure)", () => {
    const create = readFileSync(CREATE_CLIENT, "utf8");
    assert.match(create, /warmOperatorWizardShell\(session\.pluginId\)/);
    assert.doesNotMatch(create, /ensureFlatEditChromeReady/);
    assert.doesNotMatch(create, /ensureFlatEditFormReady/);
    assert.doesNotMatch(create, /ensureFlatEditPageReady/);
  });

  it("B) flat-edit page client explicitly ensures chrome/form/page before Ready", () => {
    const flat = readFileSync(FLAT_EDIT_CLIENT, "utf8");
    assert.match(flat, /warmOperatorWizardShell/);
    assert.match(flat, /ensureFlatEditChromeReady/);
    assert.match(flat, /ensureFlatEditFormReady/);
    assert.match(flat, /ensureFlatEditPageReady/);
    assert.match(flat, /warmFlatEditOperatorShell/);
    assert.match(flat, /areFlatEditSurfacesWarm/);
  });
});
