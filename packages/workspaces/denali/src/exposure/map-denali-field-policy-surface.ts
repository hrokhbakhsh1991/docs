import type { FieldPolicySurface } from "@app-tour/platform-core";

import { DENALI_EXPOSURE_SURFACE } from "./denali-exposure-surfaces";

/** Maps exposure coordinates to workspace-sdk FieldPolicy surfaces. */
export function mapDenaliExposureSurfaceToFieldPolicySurface(
  exposureSurface: string,
): FieldPolicySurface {
  if (exposureSurface === DENALI_EXPOSURE_SURFACE.telegram) {
    return "delivery";
  }
  if (
    exposureSurface === DENALI_EXPOSURE_SURFACE.publicList ||
    exposureSurface === DENALI_EXPOSURE_SURFACE.publicDetails
  ) {
    return "public_website";
  }
  if (
    exposureSurface === DENALI_EXPOSURE_SURFACE.userDashboard ||
    exposureSurface === DENALI_EXPOSURE_SURFACE.reminderFeed
  ) {
    return "profile";
  }
  return "delivery";
}
