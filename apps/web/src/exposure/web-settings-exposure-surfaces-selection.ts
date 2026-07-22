import {
  catalogFieldIdsFromExposureFields,
  resolveEffectiveSelectedFieldIds,
  setExposureCustomizeFields,
  toExposureChecklistFields,
  toggleExposureFieldSelection,
} from "@/exposure/exposure-field-selection";
import type { SettingsExposureSurfacesSelection } from "@/features/settings/settings-exposure-surfaces-ui-types";

/**
 * Web adapter for SettingsExposureSurfacesSelection (H1.c.2.b).
 * Keeps generic exposure selection SoT in the shell exposure layer.
 */
export const webSettingsExposureSurfacesSelection: SettingsExposureSurfacesSelection =
  Object.freeze({
    catalogFieldIdsFromExposureFields,
    toExposureChecklistFields,
    resolveEffectiveSelectedFieldIds,
    toggleExposureFieldSelection,
    setExposureCustomizeFields,
  });
