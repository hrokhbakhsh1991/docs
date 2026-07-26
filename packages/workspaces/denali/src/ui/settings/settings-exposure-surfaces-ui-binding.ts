/**
 * Public host entry for settings exposure surfaces UI (H1.c.2.b).
 * Types live in the sibling module; this barrel exports the panel + surface object.
 */
export type {
  DenaliSettingsExposureSurfacesCatalogField,
  DenaliSettingsExposureSurfaceDefinition,
  DenaliSettingsExposureSurfacesPatchInput,
  DenaliSettingsExposureSurfacesIo,
  DenaliSettingsExposureSurfacesChrome,
  DenaliSettingsExposureSurfacesSelection,
  DenaliSettingsExposureSurfacesPanelProps,
  DenaliSettingsExposureSurfacesUiSurface,
} from "./settings-exposure-surfaces-ui-surface";
export { DENALI_SETTINGS_EXPOSURE_SURFACES_UI_KEYS } from "./settings-exposure-surfaces-ui-surface";

export { DenaliWorkspaceSurfacesPanel } from "./denali-workspace-surfaces-panel";

import { DenaliWorkspaceSurfacesPanel } from "./denali-workspace-surfaces-panel";
import type { DenaliSettingsExposureSurfacesUiSurface } from "./settings-exposure-surfaces-ui-surface";

export const denaliSettingsExposureSurfacesUiSurface: DenaliSettingsExposureSurfacesUiSurface =
  Object.freeze({
    WorkspaceSurfacesPanel: DenaliWorkspaceSurfacesPanel,
  });
