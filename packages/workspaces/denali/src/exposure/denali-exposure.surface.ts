import {
  validateExposureSurface,
  type WorkspaceExposureSurface,
} from "@app-tour/workspace-sdk";

import {
  DENALI_EXPOSURE_SURFACE,
  DENALI_EXPOSURE_SURFACE_DEFINITIONS,
} from "./denali-exposure-surfaces";

export function resolveDenaliExposureTriggerStorageKey(input: {
  readonly surface: string;
  readonly triggerLabel: string;
}): string {
  if (input.surface === DENALI_EXPOSURE_SURFACE.reminderFeed) {
    return "relative:-48h";
  }
  if (input.triggerLabel === "always") {
    return "always";
  }
  if (input.triggerLabel === "relative_to_tour_start") {
    return "relative:-48h";
  }
  return input.triggerLabel;
}

export const denaliExposureSurface = Object.freeze({
  manifestVersion: 1 as const,
  definitions: Object.freeze(
    DENALI_EXPOSURE_SURFACE_DEFINITIONS.map((definition) =>
      Object.freeze({
        surface: definition.surface,
        audience: definition.audience,
        triggerLabel: definition.triggerLabel,
        triggerStorageKey: resolveDenaliExposureTriggerStorageKey({
          surface: definition.surface,
          triggerLabel: definition.triggerLabel,
        }),
        defaultFieldIds: definition.defaultFieldIds,
        operatorSettingsVisible: definition.surface !== DENALI_EXPOSURE_SURFACE.telegram,
      }),
    ),
  ),
}) satisfies WorkspaceExposureSurface;

validateExposureSurface(denaliExposureSurface);

export function getDenaliExposureSurface(): WorkspaceExposureSurface {
  return denaliExposureSurface;
}
