import type { UiSurfaceModule } from "./import-ui-surface";

type ImportUiSurfaceLoader = () => Promise<UiSurfaceModule>;

/**
 * B1.1 static registry — each key is the legacy relative specifier passed by wizard/settings
 * warm surfaces. Values use same-package static imports to `src/ui/*` (equivalent to
 * `@app-tour/workspace-denali/host/ui/*` package exports for consumers).
 */
export const IMPORT_UI_SURFACE_LOADERS = {
  "../ui/surfaces/composite-surface": () =>
    import("../ui/surfaces/composite-surface"),
  "../ui/surfaces/review-surface": () =>
    import("../ui/surfaces/review-surface"),
  "../ui/surfaces/field-label-resolver": () =>
    import("../ui/surfaces/field-label-resolver"),
  "../ui/operator-ui-components-surface": () =>
    import("../ui/operator-ui-components-surface"),
  "../ui/chrome/build-denali-flat-edit-tour-load-result": () =>
    import("../ui/chrome/build-denali-flat-edit-tour-load-result"),
  "../ui/chrome/map-denali-flat-edit-tour-http-status": () =>
    import("../ui/chrome/map-denali-flat-edit-tour-http-status"),
  "../ui/hooks/denali-wizard-catalog-prefetch-context": () =>
    import("../ui/hooks/denali-wizard-catalog-prefetch-context"),
  "../ui/adapters/localize-exposure-catalog-fields": () =>
    import("../ui/adapters/localize-exposure-catalog-fields"),
  "../ui/chrome/build-denali-flat-edit-meta-line": () =>
    import("../ui/chrome/build-denali-flat-edit-meta-line"),
  "../ui/adapters/read-active-catalog-ids-from-payload": () =>
    import("../ui/adapters/read-active-catalog-ids-from-payload"),
  "../ui/chrome/wizard-create-chrome-surface": () =>
    import("../ui/chrome/wizard-create-chrome-surface"),
  "../ui/chrome/wizard-create-view-surface": () =>
    import("../ui/chrome/wizard-create-view-surface"),
  "../ui/chrome/wizard-flat-edit-chrome-surface": () =>
    import("../ui/chrome/wizard-flat-edit-chrome-surface"),
  "../ui/chrome/wizard-flat-edit-form-surface": () =>
    import("../ui/chrome/wizard-flat-edit-form-surface"),
  "../ui/chrome/wizard-flat-edit-page-surface": () =>
    import("../ui/chrome/wizard-flat-edit-page-surface"),
  "../ui/settings/settings-exposure-surfaces-ui-binding": () =>
    import("../ui/settings/settings-exposure-surfaces-ui-binding"),
  "../ui/settings/settings-equipment-ui-surface": () =>
    import("../ui/settings/settings-equipment-ui-surface"),
} satisfies Record<string, ImportUiSurfaceLoader>;

export type ImportUiSurfaceSpecifier = keyof typeof IMPORT_UI_SURFACE_LOADERS;

export function resolveImportUiSurfaceLoader(specifier: string): ImportUiSurfaceLoader {
  const loader = IMPORT_UI_SURFACE_LOADERS[specifier as ImportUiSurfaceSpecifier];
  if (loader === undefined) {
    const supported = Object.keys(IMPORT_UI_SURFACE_LOADERS).join(", ");
    throw new Error(
      `DENALI_IMPORT_UI_SURFACE_UNSUPPORTED: unsupported importUiSurface specifier "${specifier}". Supported specifiers: ${supported}`
    );
  }
  return loader;
}
