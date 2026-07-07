import {
  validateExposureSurface,
  type WorkspaceExposureSurface,
} from "@app-tour/workspace-sdk";

import { URBAN_EXPOSURE_SURFACE_DEFINITIONS } from "./urban-exposure-surfaces";

export const urbanExposureSurface = Object.freeze({
  manifestVersion: 1 as const,
  definitions: Object.freeze(
    URBAN_EXPOSURE_SURFACE_DEFINITIONS.map((definition) =>
      Object.freeze({
        surface: definition.surface,
        audience: definition.audience,
        triggerLabel: definition.triggerLabel,
        triggerStorageKey: "always",
        defaultFieldIds: definition.defaultFieldIds,
        operatorSettingsVisible: true,
      }),
    ),
  ),
}) satisfies WorkspaceExposureSurface;

validateExposureSurface(urbanExposureSurface);

export function getUrbanExposureSurface(): WorkspaceExposureSurface {
  return urbanExposureSurface;
}
