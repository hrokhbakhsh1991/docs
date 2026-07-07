import {
  validateExposureSurface,
  type WorkspaceExposureSurface,
} from "@app-tour/workspace-sdk";

import { STARTER_EXPOSURE_SURFACE_DEFINITIONS } from "./starter-exposure-surfaces";

export const starterExposureSurface = Object.freeze({
  manifestVersion: 1 as const,
  definitions: Object.freeze(
    STARTER_EXPOSURE_SURFACE_DEFINITIONS.map((definition) => Object.freeze({ ...definition })),
  ),
}) satisfies WorkspaceExposureSurface;

validateExposureSurface(starterExposureSurface);

export function getStarterExposureSurface(): WorkspaceExposureSurface {
  return starterExposureSurface;
}
