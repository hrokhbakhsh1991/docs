import type { FieldPolicySurface } from "@app-tour/platform-core";

import { URBAN_EXPOSURE_SURFACE } from "./urban-exposure-surfaces";

/** Maps exposure coordinates to workspace-sdk FieldPolicy surfaces. */
export function mapUrbanExposureSurfaceToFieldPolicySurface(
  exposureSurface: string,
): FieldPolicySurface {
  if (
    exposureSurface === URBAN_EXPOSURE_SURFACE.publicList ||
    exposureSurface === URBAN_EXPOSURE_SURFACE.publicDetails
  ) {
    return "public_website";
  }
  return "delivery";
}
