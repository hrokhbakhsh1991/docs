import type { UiSurfaceModule } from "./import-ui-surface";

const UI_SURFACE_LOADERS: Record<string, () => Promise<UiSurfaceModule>> = {
  "../ui/chrome/wizard-create-chrome-surface": () =>
    import("../ui/chrome/wizard-create-chrome-surface") as Promise<UiSurfaceModule>,
  "../ui/chrome/wizard-create-view-surface": () =>
    import("../ui/chrome/wizard-create-view-surface") as Promise<UiSurfaceModule>,
  "../ui/chrome/wizard-flat-edit-chrome-surface": () =>
    import("../ui/chrome/wizard-flat-edit-chrome-surface") as Promise<UiSurfaceModule>,
  "../ui/chrome/wizard-flat-edit-form-surface": () =>
    import("../ui/chrome/wizard-flat-edit-form-surface") as Promise<UiSurfaceModule>,
  "../ui/chrome/wizard-flat-edit-page-surface": () =>
    import("../ui/chrome/wizard-flat-edit-page-surface") as Promise<UiSurfaceModule>,
  "../ui/chrome/build-denali-flat-edit-meta-line": () =>
    import("../ui/chrome/build-denali-flat-edit-meta-line") as Promise<UiSurfaceModule>,
  "../ui/chrome/build-denali-flat-edit-tour-load-result": () =>
    import("../ui/chrome/build-denali-flat-edit-tour-load-result") as Promise<UiSurfaceModule>,
  "../ui/chrome/map-denali-flat-edit-tour-http-status": () =>
    import("../ui/chrome/map-denali-flat-edit-tour-http-status") as Promise<UiSurfaceModule>,
  "../ui/adapters/localize-exposure-catalog-fields": () =>
    import("../ui/adapters/localize-exposure-catalog-fields") as Promise<UiSurfaceModule>,
  "../ui/adapters/read-active-catalog-ids-from-payload": () =>
    import("../ui/adapters/read-active-catalog-ids-from-payload") as Promise<UiSurfaceModule>,
  "../ui/hooks/denali-wizard-catalog-prefetch-context": () =>
    import("../ui/hooks/denali-wizard-catalog-prefetch-context") as Promise<UiSurfaceModule>,
  "../ui/operator-ui-components-surface": () =>
    import("../ui/operator-ui-components-surface") as Promise<UiSurfaceModule>,
  "../ui/settings/settings-equipment-ui-surface": () =>
    import("../ui/settings/settings-equipment-ui-surface") as Promise<UiSurfaceModule>,
  "../ui/settings/settings-exposure-surfaces-ui-binding": () =>
    import("../ui/settings/settings-exposure-surfaces-ui-binding") as Promise<UiSurfaceModule>,
  "../ui/surfaces/composite-surface": () =>
    import("../ui/surfaces/composite-surface") as Promise<UiSurfaceModule>,
  "../ui/surfaces/field-label-resolver": () =>
    import("../ui/surfaces/field-label-resolver") as Promise<UiSurfaceModule>,
  "../ui/surfaces/review-surface": () =>
    import("../ui/surfaces/review-surface") as Promise<UiSurfaceModule>,
};

export function loadUiSurface(specifier: string): Promise<UiSurfaceModule> {
  const loader = UI_SURFACE_LOADERS[specifier];
  return loader != null
    ? loader()
    : Promise.reject(new Error(`Unknown UI surface specifier: ${specifier}`));
}
