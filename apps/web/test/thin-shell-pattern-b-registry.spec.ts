/**
 * Thin Shell Phase 4bl–4bt — Pattern B registry keying inventory + Map locks.
 * @see docs/dev/thin-shell-pattern-b-registry.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");
const DENALI_SRC = resolve(REPO_ROOT, "packages/workspaces/denali/src");
const DENALI_WIZARD = resolve(DENALI_SRC, "wizard");

/** Product-blind globals that must be Map<pluginId, surface> after 4bl–4bs. */
const MAP_KEYED = Object.freeze([
  {
    key: "app-cloud.wizardCreateChromeSurface",
    shell: "src/wizard/wizard-create-chrome-registry.ts",
    pkg: "wizard/create-chrome-surface.ts",
  },
  {
    key: "app-cloud.wizardFlatEditChromeSurface",
    shell: "src/wizard/wizard-flat-edit-chrome-registry.ts",
    pkg: "wizard/flat-edit-chrome-surface.ts",
  },
  {
    key: "app-cloud.wizardCreateViewSurface",
    shell: "src/wizard/wizard-create-view-registry.ts",
    pkg: "wizard/create-view-surface.ts",
  },
  {
    key: "app-cloud.wizardFlatEditFormSurface",
    shell: "src/wizard/wizard-flat-edit-form-registry.ts",
    pkg: "wizard/flat-edit-form-surface.ts",
  },
  {
    key: "app-cloud.wizardFlatEditPageSurface",
    shell: "src/wizard/wizard-flat-edit-page-registry.ts",
    pkg: "wizard/flat-edit-page-surface.ts",
  },
  {
    key: "app-cloud.operatorUiComponentsSurface",
    shell: "src/wizard/operator-ui-components-registry.ts",
    pkg: "wizard/operator-ui-surface.ts",
  },
  {
    key: "app-cloud.wizardHostAdapterSurface",
    shell: "src/wizard/wizard-host-adapter-registry.ts",
    pkg: "wizard/host-adapter-surface.ts",
  },
  {
    key: "app-cloud.settingsEquipmentUiSurface",
    shell: "src/features/settings/settings-equipment-ui-registry.ts",
    pkg: "settings/settings-equipment-ui-package-surface.ts",
  },
  {
    key: "app-cloud.settingsExposureSurfacesUiSurface",
    shell: "src/features/settings/settings-exposure-surfaces-ui-registry.ts",
    pkg: "settings/settings-exposure-surfaces-ui-package-surface.ts",
  },
  {
    key: "app-cloud.wizardLabelResolverCache",
    shell: "src/wizard/wizard-label-registry.ts",
    pkg: "wizard/label-resolver-surface.ts",
  },
  {
    key: "app-cloud.wizardCompositeSurfaceCache",
    shell: "src/wizard/wizard-surface-registry.ts",
    pkg: "wizard/wizard-surfaces-surface.ts",
  },
  {
    key: "app-cloud.wizardReviewSurfaceCache",
    shell: "src/wizard/wizard-surface-registry.ts",
    pkg: "wizard/wizard-surfaces-surface.ts",
  },
]);

/** Pattern B singleton debt — closed in Phase 4bs (empty). */
const SINGLETON_DEBT = Object.freeze([]);

describe("thin-shell-pattern-b-registry — Phase 4bl–4bt", () => {
  it("TS-4BL-01 create-chrome shell + package are Map<pluginId> keyed", () => {
    const shell = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-create-chrome-registry.ts"),
      "utf8"
    );
    const pkg = readFileSync(resolve(DENALI_WIZARD, "create-chrome-surface.ts"), "utf8");

    for (const src of [shell, pkg]) {
      assert.match(src, /Map<string,\s*WizardCreateChromeSurface>/);
      assert.match(src, /getCache\(\)/);
      assert.match(src, /pluginId/);
      assert.doesNotMatch(
        src,
        /\[WIZARD_CREATE_CHROME_SURFACE_KEY\]\?:\s*WizardCreateChromeSurface\s*;/
      );
    }

    assert.match(shell, /peekWizardCreateChromeSurface\(\s*pluginId/);
    assert.match(shell, /input\.session\.pluginId/);
    assert.match(shell, /instanceof Map/);
    assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(pkg, /instanceof Map/);
  });

  it("TS-4BM-01 flat-edit chrome shell + package are Map<pluginId> keyed", () => {
    const shell = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-flat-edit-chrome-registry.ts"),
      "utf8"
    );
    const pkg = readFileSync(resolve(DENALI_WIZARD, "flat-edit-chrome-surface.ts"), "utf8");
    const flatPage = readFileSync(resolve(WEB_ROOT, "src/wizard/use-flat-edit-page.ts"), "utf8");

    for (const src of [shell, pkg]) {
      assert.match(src, /Map<string,\s*WizardFlatEditChromeSurface>/);
      assert.match(src, /getCache\(\)/);
      assert.match(src, /pluginId/);
      assert.match(src, /instanceof Map/);
      assert.doesNotMatch(
        src,
        /\[WIZARD_FLAT_EDIT_CHROME_SURFACE_KEY\]\?:\s*WizardFlatEditChromeSurface\s*;/
      );
    }

    assert.match(shell, /peekWizardFlatEditChromeSurface\(\s*pluginId/);
    assert.match(shell, /input\.plugin\.id/);
    assert.match(shell, /loadOperatorSubmitCatalogIds\(\s*pluginId/);
    assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(flatPage, /loadOperatorSubmitCatalogIds\(plugin\.id/);
  });

  it("TS-4BN-01 create-view shell + package are Map<pluginId> keyed", () => {
    const shell = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-create-view-registry.ts"),
      "utf8"
    );
    const pkg = readFileSync(resolve(DENALI_WIZARD, "create-view-surface.ts"), "utf8");
    const ready = readFileSync(
      resolve(WEB_ROOT, "app/tours/new/create-tour-wizard-client-ready.tsx"),
      "utf8"
    );

    for (const src of [shell, pkg]) {
      assert.match(src, /Map<string,\s*WizardCreateViewSurface>/);
      assert.match(src, /getCache\(\)/);
      assert.match(src, /pluginId/);
      assert.match(src, /instanceof Map/);
      assert.doesNotMatch(
        src,
        /\[WIZARD_CREATE_VIEW_SURFACE_KEY\]\?:\s*WizardCreateViewSurface\s*;/
      );
    }

    assert.match(shell, /peekWizardCreateViewSurface\(\s*pluginId/);
    assert.match(shell, /resolveWizardCreateViewSurface\(\s*pluginId/);
    assert.match(shell, /return peekWizardCreateViewSurface\(pluginId\)/);
    assert.doesNotMatch(shell, /_pluginId/);
    assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(ready, /resolveWizardCreateViewSurface\(plugin\.id\)/);
  });

  it("TS-4BO-01 flat-edit form shell + package are Map<pluginId> keyed", () => {
    const shell = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-flat-edit-form-registry.ts"),
      "utf8"
    );
    const pkg = readFileSync(resolve(DENALI_WIZARD, "flat-edit-form-surface.ts"), "utf8");
    const formShell = readFileSync(
      resolve(WEB_ROOT, "src/wizard/flat-edit-form-shell.tsx"),
      "utf8"
    );

    for (const src of [shell, pkg]) {
      assert.match(src, /Map<string,\s*WizardFlatEditFormSurface>/);
      assert.match(src, /getCache\(\)/);
      assert.match(src, /pluginId/);
      assert.match(src, /instanceof Map/);
      assert.doesNotMatch(
        src,
        /\[WIZARD_FLAT_EDIT_FORM_SURFACE_KEY\]\?:\s*WizardFlatEditFormSurface\s*;/
      );
    }

    assert.match(shell, /peekWizardFlatEditFormSurface\(\s*pluginId/);
    assert.match(shell, /resolveWizardFlatEditFormSurface\(\s*pluginId/);
    assert.match(shell, /resolveOperatorFlatEditTestIds\(\s*pluginId/);
    assert.doesNotMatch(shell, /_pluginId/);
    assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(formShell, /resolveWizardFlatEditFormSurface\(session\.pluginId\)/);
  });

  it("TS-4BP-01 flat-edit page shell + package are Map<pluginId> keyed", () => {
    const shell = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-flat-edit-page-registry.ts"),
      "utf8"
    );
    const pkg = readFileSync(resolve(DENALI_WIZARD, "flat-edit-page-surface.ts"), "utf8");
    const client = readFileSync(
      resolve(WEB_ROOT, "app/(app)/tours/[id]/edit/flat-edit-page-client.tsx"),
      "utf8"
    );

    for (const src of [shell, pkg]) {
      assert.match(src, /Map<string,\s*WizardFlatEditPageSurface>/);
      assert.match(src, /getCache\(\)/);
      assert.match(src, /pluginId/);
      assert.match(src, /instanceof Map/);
      assert.doesNotMatch(
        src,
        /\[WIZARD_FLAT_EDIT_PAGE_SURFACE_KEY\]\?:\s*WizardFlatEditPageSurface\s*;/
      );
    }

    assert.match(shell, /peekWizardFlatEditPageSurface\(\s*pluginId/);
    assert.match(shell, /resolveWizardFlatEditPageSurface\(\s*pluginId/);
    assert.doesNotMatch(shell, /_pluginId/);
    assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(client, /resolveWizardFlatEditPageSurface\(plugin\.id\)/);
  });

  it("TS-4BQ-01 operator-ui shell + package are Map<pluginId> keyed", () => {
    const shell = readFileSync(
      resolve(WEB_ROOT, "src/wizard/operator-ui-components-registry.ts"),
      "utf8"
    );
    const pkg = readFileSync(resolve(DENALI_WIZARD, "operator-ui-surface.ts"), "utf8");
    const datetime = readFileSync(
      resolve(WEB_ROOT, "src/components/i18n/localized-datetime-picker.tsx"),
      "utf8"
    );

    for (const src of [shell, pkg]) {
      assert.match(src, /Map<string,\s*OperatorUiComponentsSurface>/);
      assert.match(src, /getCache\(\)/);
      assert.match(src, /pluginId/);
      assert.match(src, /instanceof Map/);
      assert.doesNotMatch(
        src,
        /\[OPERATOR_UI_COMPONENTS_SURFACE_KEY\]\?:\s*OperatorUiComponentsSurface\s*;/
      );
    }

    assert.match(shell, /peekOperatorUiComponentsSurface\(\s*pluginId/);
    assert.match(shell, /peekOperatorUiComponentsSurface\(plugin\.id\)/);
    assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(datetime, /resolveOperatorUiComponentsSurface\(session\.pluginId\)/);
  });

  it("TS-4BR-01 host-adapter shell + package are Map<pluginId> keyed", () => {
    const shell = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-host-adapter-registry.ts"),
      "utf8"
    );
    const pkg = readFileSync(resolve(DENALI_WIZARD, "host-adapter-surface.ts"), "utf8");
    const createReady = readFileSync(
      resolve(WEB_ROOT, "app/tours/new/create-tour-wizard-client-ready.tsx"),
      "utf8"
    );
    const editReady = readFileSync(
      resolve(WEB_ROOT, "app/(app)/tours/[id]/edit/tour-edit-page-client.tsx"),
      "utf8"
    );

    for (const src of [shell, pkg]) {
      assert.match(src, /Map<string,\s*WizardHostAdapterSurface>/);
      assert.match(src, /getCache\(\)/);
      assert.match(src, /instanceof Map/);
      assert.doesNotMatch(src, /WIZARD_HOST_ADAPTER_ACTIVE_PLUGIN_ID_KEY/);
      assert.doesNotMatch(src, /wizardHostAdapterActivePluginId/);
      assert.doesNotMatch(
        src,
        /\[WIZARD_HOST_ADAPTER_SURFACE_KEY\]\?:\s*WizardHostAdapterSurface\s*;/
      );
    }

    assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(shell, /resolveWizardCatalogPrefetchProvider\(\s*pluginId:\s*string/);
    assert.match(createReady, /resolveWizardCatalogPrefetchProvider\(session\.pluginId\)/);
    assert.match(editReady, /resolveWizardCatalogPrefetchProvider\(session\.pluginId\)/);
  });

  it("TS-4BT-01 host-adapter sync helpers require pluginId (no ambient active-id)", () => {
    const shell = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-host-adapter-registry.ts"),
      "utf8"
    );
    const createWizard = readFileSync(
      resolve(WEB_ROOT, "src/wizard/use-create-tour-wizard.ts"),
      "utf8"
    );
    const flatEdit = readFileSync(resolve(WEB_ROOT, "src/wizard/use-flat-edit-page.ts"), "utf8");
    const flatIo = readFileSync(
      resolve(WEB_ROOT, "src/wizard/web-operator-flat-edit-page-io.ts"),
      "utf8"
    );
    const submitErr = readFileSync(
      resolve(WEB_ROOT, "src/wizard/resolve-wizard-submit-error-message.ts"),
      "utf8"
    );

    assert.match(shell, /export function buildWizardFreshStartMeta\(pluginId:\s*string/);
    assert.match(shell, /export function buildWizardStepZeroMeta\(pluginId:\s*string/);
    assert.match(shell, /export function mapFlatEditTourHttpStatus\(\s*pluginId:\s*string/);
    assert.match(shell, /export function localizeExposureCatalogFields</);
    assert.match(shell, /pluginId:\s*string,\s*fields:/);
    assert.doesNotMatch(shell, /function resolveLookupId/);
    assert.doesNotMatch(shell, /cache\.size === 1/);

    assert.match(createWizard, /buildWizardFreshStartMeta\(wizardPlugin\.id/);
    assert.match(createWizard, /createTourRemoteDraftIdentity\(wizardPlugin\.id\)/);
    assert.match(flatEdit, /editTourRemoteDraftIdentity\(plugin\.id,\s*tourId\)/);
    assert.match(flatEdit, /buildWizardStepZeroMeta\(plugin\.id,/);
    assert.match(flatIo, /mapFlatEditTourHttpStatus\(plugin\.id,/);
    assert.match(flatIo, /finalizeFlatEditTourLoad\(plugin\.id,/);
    assert.match(submitErr, /readonly pluginId:\s*string/);
    assert.match(submitErr, /localizeWizardValidationIssueMessage\(\s*input\.pluginId/);
  });

  it("TS-4BL-02 Map-keyed package publishers use DENALI_WORKSPACE_PLUGIN_ID", () => {
    for (const entry of MAP_KEYED) {
      if (entry.pkg == null) continue;
      const pkg = readFileSync(resolve(DENALI_SRC, entry.pkg), "utf8");
      assert.match(pkg, new RegExp(entry.key.replace(/\./g, "\\.")));
      assert.match(pkg, /DENALI_WORKSPACE_PLUGIN_ID/);
      assert.doesNotMatch(pkg, /const surfaceId = ["']denali["']/);
    }
  });

  it("TS-4BS-01 settings equipment + exposure shell/package are Map<pluginId> keyed", () => {
    const eqShell = readFileSync(
      resolve(WEB_ROOT, "src/features/settings/settings-equipment-ui-registry.ts"),
      "utf8"
    );
    const eqPkg = readFileSync(
      resolve(DENALI_SRC, "settings/settings-equipment-ui-package-surface.ts"),
      "utf8"
    );
    const expShell = readFileSync(
      resolve(WEB_ROOT, "src/features/settings/settings-exposure-surfaces-ui-registry.ts"),
      "utf8"
    );
    const expPkg = readFileSync(
      resolve(DENALI_SRC, "settings/settings-exposure-surfaces-ui-package-surface.ts"),
      "utf8"
    );

    for (const src of [eqShell, eqPkg]) {
      assert.match(src, /Map<string,\s*SettingsEquipmentUi/);
      assert.match(src, /getCache\(\)/);
      assert.match(src, /instanceof Map/);
      assert.match(src, /pluginId/);
    }
    for (const src of [expShell, expPkg]) {
      assert.match(src, /Map<string,\s*SettingsExposureSurfacesUi/);
      assert.match(src, /getCache\(\)/);
      assert.match(src, /instanceof Map/);
      assert.match(src, /pluginId/);
    }
    assert.match(eqPkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(expPkg, /DENALI_WORKSPACE_PLUGIN_ID/);
    assert.match(eqShell, /peekSettingsEquipmentUiSurface\(\s*pluginId/);
    assert.match(expShell, /peekSettingsExposureSurfacesUiSurface\(\s*pluginId/);
  });

  it("TS-4BL-03 Pattern B singleton debt is empty (closed 4bs)", () => {
    assert.equal(SINGLETON_DEBT.length, 0);
  });

  it("TS-4BL-04 Map-keyed global key strings locked", () => {
    for (const entry of MAP_KEYED) {
      const shell = readFileSync(resolve(WEB_ROOT, entry.shell), "utf8");
      assert.match(shell, new RegExp(entry.key.replace(/\./g, "\\.")));
    }
  });
});
