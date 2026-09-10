import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

import {
  IMPORT_UI_SURFACE_LOADERS,
  type ImportUiSurfaceSpecifier,
} from "../src/wizard/import-ui-surface.loaders.ts";
import { importUiSurface } from "../src/wizard/import-ui-surface.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageRequire = createRequire(pathToFileURL(join(packageRoot, "package.json")));

type ShapeAssert = (mod: Record<string, unknown>) => void;

const PACKAGE_EXPORT_BY_SPECIFIER = {
  "../ui/surfaces/composite-surface": "@app-tour/workspace-denali/host/ui/composite-surface",
  "../ui/surfaces/review-surface": "@app-tour/workspace-denali/host/ui/review-surface",
  "../ui/surfaces/field-label-resolver": "@app-tour/workspace-denali/host/ui/field-label-resolver",
  "../ui/operator-ui-components-surface": "@app-tour/workspace-denali/host/ui/operator-ui-components-surface",
  "../ui/chrome/build-denali-flat-edit-tour-load-result":
    "@app-tour/workspace-denali/host/ui/chrome/build-denali-flat-edit-tour-load-result",
  "../ui/chrome/map-denali-flat-edit-tour-http-status":
    "@app-tour/workspace-denali/host/ui/chrome/map-denali-flat-edit-tour-http-status",
  "../ui/hooks/denali-wizard-catalog-prefetch-context":
    "@app-tour/workspace-denali/host/ui/hooks/denali-wizard-catalog-prefetch-context",
  "../ui/adapters/localize-exposure-catalog-fields":
    "@app-tour/workspace-denali/host/ui/adapters/localize-exposure-catalog-fields",
  "../ui/chrome/build-denali-flat-edit-meta-line":
    "@app-tour/workspace-denali/host/ui/chrome/build-denali-flat-edit-meta-line",
  "../ui/adapters/read-active-catalog-ids-from-payload":
    "@app-tour/workspace-denali/host/ui/adapters/read-active-catalog-ids-from-payload",
  "../ui/chrome/wizard-create-chrome-surface":
    "@app-tour/workspace-denali/host/ui/chrome/wizard-create-chrome-surface",
  "../ui/chrome/wizard-create-view-surface":
    "@app-tour/workspace-denali/host/ui/chrome/wizard-create-view-surface",
  "../ui/chrome/wizard-flat-edit-chrome-surface":
    "@app-tour/workspace-denali/host/ui/chrome/wizard-flat-edit-chrome-surface",
  "../ui/chrome/wizard-flat-edit-form-surface":
    "@app-tour/workspace-denali/host/ui/chrome/wizard-flat-edit-form-surface",
  "../ui/chrome/wizard-flat-edit-page-surface":
    "@app-tour/workspace-denali/host/ui/chrome/wizard-flat-edit-page-surface",
  "../ui/settings/settings-exposure-surfaces-ui-binding":
    "@app-tour/workspace-denali/host/ui/settings/settings-exposure-surfaces-ui-surface",
  "../ui/settings/settings-equipment-ui-surface":
    "@app-tour/workspace-denali/host/ui/settings/settings-equipment-ui-surface",
} satisfies Record<ImportUiSurfaceSpecifier, string>;

/** Node unit tests cannot execute these dist bundles (CSS require chain). */
const NODE_CSS_BOUND_SPECIFIERS = new Set<ImportUiSurfaceSpecifier>([
  "../ui/surfaces/review-surface",
  "../ui/operator-ui-components-surface",
  "../ui/settings/settings-exposure-surfaces-ui-binding",
  "../ui/settings/settings-equipment-ui-surface",
]);

const DIST_EXPORT_SNIPPETS: Record<ImportUiSurfaceSpecifier, readonly string[]> = {
  "../ui/surfaces/composite-surface": ["createDenaliCompositeSurface"],
  "../ui/surfaces/review-surface": ["createDenaliReviewSurface"],
  "../ui/surfaces/field-label-resolver": ["createDenaliFieldLabelResolver"],
  "../ui/operator-ui-components-surface": ["denaliOperatorUiComponentsSurface"],
  "../ui/chrome/build-denali-flat-edit-tour-load-result": [
    "buildDenaliFlatEditTourLoadSuccess",
    "denaliFlatEditHydratorUnavailableResult",
    "finalizeDenaliFlatEditTourLoad",
  ],
  "../ui/chrome/map-denali-flat-edit-tour-http-status": ["mapDenaliFlatEditTourHttpStatus"],
  "../ui/hooks/denali-wizard-catalog-prefetch-context": [
    "DenaliWizardCatalogPrefetchProvider",
    "useDenaliWizardCatalogPrefetch",
  ],
  "../ui/adapters/localize-exposure-catalog-fields": ["localizeExposureCatalogFields"],
  "../ui/chrome/build-denali-flat-edit-meta-line": ["buildDenaliFlatEditMetaLine"],
  "../ui/adapters/read-active-catalog-ids-from-payload": [
    "resolveActiveCatalogIdsFromResourcePayloads",
  ],
  "../ui/chrome/wizard-create-chrome-surface": ["denaliWizardCreateChromeSurface"],
  "../ui/chrome/wizard-create-view-surface": ["denaliWizardCreateViewSurface"],
  "../ui/chrome/wizard-flat-edit-chrome-surface": ["denaliWizardFlatEditChromeSurface"],
  "../ui/chrome/wizard-flat-edit-form-surface": ["denaliWizardFlatEditFormSurface"],
  "../ui/chrome/wizard-flat-edit-page-surface": ["denaliWizardFlatEditPageSurface"],
  "../ui/settings/settings-exposure-surfaces-ui-binding": [
    "denaliSettingsExposureSurfacesUiSurface",
  ],
  "../ui/settings/settings-equipment-ui-surface": ["denaliSettingsEquipmentUiSurface"],
};

const REGISTRY_SHAPE_ASSERTIONS = {
  "../ui/surfaces/composite-surface": (mod) => {
    assert.equal(typeof mod.createDenaliCompositeSurface, "function");
  },
  "../ui/surfaces/review-surface": (mod) => {
    assert.equal(typeof mod.createDenaliReviewSurface, "function");
  },
  "../ui/surfaces/field-label-resolver": (mod) => {
    assert.equal(typeof mod.createDenaliFieldLabelResolver, "function");
  },
  "../ui/operator-ui-components-surface": (mod) => {
    assert.equal(typeof mod.denaliOperatorUiComponentsSurface, "object");
    assert.notEqual(mod.denaliOperatorUiComponentsSurface, null);
    assert.equal(
      typeof (mod.denaliOperatorUiComponentsSurface as { TimeInput?: unknown }).TimeInput,
      "function"
    );
  },
  "../ui/chrome/build-denali-flat-edit-tour-load-result": (mod) => {
    assert.equal(typeof mod.buildDenaliFlatEditTourLoadSuccess, "function");
    assert.equal(typeof mod.denaliFlatEditHydratorUnavailableResult, "function");
    assert.equal(typeof mod.finalizeDenaliFlatEditTourLoad, "function");
  },
  "../ui/chrome/map-denali-flat-edit-tour-http-status": (mod) => {
    assert.equal(typeof mod.mapDenaliFlatEditTourHttpStatus, "function");
  },
  "../ui/hooks/denali-wizard-catalog-prefetch-context": (mod) => {
    assert.equal(typeof mod.DenaliWizardCatalogPrefetchProvider, "function");
    assert.equal(typeof mod.useDenaliWizardCatalogPrefetch, "function");
  },
  "../ui/adapters/localize-exposure-catalog-fields": (mod) => {
    assert.equal(typeof mod.localizeExposureCatalogFields, "function");
  },
  "../ui/chrome/build-denali-flat-edit-meta-line": (mod) => {
    assert.equal(typeof mod.buildDenaliFlatEditMetaLine, "function");
  },
  "../ui/adapters/read-active-catalog-ids-from-payload": (mod) => {
    assert.equal(typeof mod.resolveActiveCatalogIdsFromResourcePayloads, "function");
  },
  "../ui/chrome/wizard-create-chrome-surface": (mod) => {
    assert.equal(typeof mod.denaliWizardCreateChromeSurface, "object");
    assert.notEqual(mod.denaliWizardCreateChromeSurface, null);
  },
  "../ui/chrome/wizard-create-view-surface": (mod) => {
    assert.equal(typeof mod.denaliWizardCreateViewSurface, "object");
    assert.notEqual(mod.denaliWizardCreateViewSurface, null);
  },
  "../ui/chrome/wizard-flat-edit-chrome-surface": (mod) => {
    assert.equal(typeof mod.denaliWizardFlatEditChromeSurface, "object");
    assert.notEqual(mod.denaliWizardFlatEditChromeSurface, null);
  },
  "../ui/chrome/wizard-flat-edit-form-surface": (mod) => {
    assert.equal(typeof mod.denaliWizardFlatEditFormSurface, "object");
    assert.notEqual(mod.denaliWizardFlatEditFormSurface, null);
  },
  "../ui/chrome/wizard-flat-edit-page-surface": (mod) => {
    assert.equal(typeof mod.denaliWizardFlatEditPageSurface, "object");
    assert.notEqual(mod.denaliWizardFlatEditPageSurface, null);
  },
  "../ui/settings/settings-exposure-surfaces-ui-binding": (mod) => {
    assert.equal(typeof mod.denaliSettingsExposureSurfacesUiSurface, "object");
    assert.notEqual(mod.denaliSettingsExposureSurfacesUiSurface, null);
  },
  "../ui/settings/settings-equipment-ui-surface": (mod) => {
    assert.equal(typeof mod.denaliSettingsEquipmentUiSurface, "object");
    assert.notEqual(mod.denaliSettingsEquipmentUiSurface, null);
  },
} satisfies Record<ImportUiSurfaceSpecifier, ShapeAssert>;

function resolvePackageExportDistPath(packageExport: string): string {
  const subpath = packageExport.replace("@app-tour/workspace-denali/", "./");
  const exports = packageRequire("./package.json").exports as Record<
    string,
    { default: string }
  >;
  const direct = exports[subpath]?.default;
  if (direct !== undefined) {
    return join(packageRoot, direct);
  }

  const wildcardMatch = subpath.match(/^\.\/host\/ui\/(adapters|hooks)\/(.+)$/);
  if (wildcardMatch !== null) {
    const [, folder, name] = wildcardMatch;
    return join(packageRoot, `dist/ui/${folder}/${name}.js`);
  }

  assert.fail(`missing package export for ${packageExport}`);
}

describe("import-ui-surface registry (B1.2)", () => {
  it("B1.2-01 every registry entry resolves to the expected module shape", async () => {
    const specifiers = Object.keys(IMPORT_UI_SURFACE_LOADERS) as ImportUiSurfaceSpecifier[];
    assert.equal(specifiers.length, 17);
    assert.deepEqual(
      specifiers.sort(),
      (Object.keys(PACKAGE_EXPORT_BY_SPECIFIER) as ImportUiSurfaceSpecifier[]).sort()
    );

    for (const specifier of specifiers) {
      const packageExport = PACKAGE_EXPORT_BY_SPECIFIER[specifier];
      const distPath = resolvePackageExportDistPath(packageExport);
      const distSource = readFileSync(distPath, "utf8");
      for (const snippet of DIST_EXPORT_SNIPPETS[specifier]) {
        assert.match(distSource, new RegExp(snippet));
      }

      if (NODE_CSS_BOUND_SPECIFIERS.has(specifier)) {
        continue;
      }

      const mod = await importUiSurface(specifier);
      REGISTRY_SHAPE_ASSERTIONS[specifier](mod);
    }
  });

  it("B1.2-02 unsupported specifiers reject with DENALI_IMPORT_UI_SURFACE_UNSUPPORTED", async () => {
    await assert.rejects(
      async () => importUiSurface("../ui/unknown-surface"),
      /DENALI_IMPORT_UI_SURFACE_UNSUPPORTED: unsupported importUiSurface specifier "\.\.\/ui\/unknown-surface"/
    );
  });
});
