import type { WorkspaceFieldPolicySurface } from "@app-tour/workspace-sdk";

export const STARTER_EXPOSURE_SURFACE = Object.freeze({
  publicList: "public_list",
} as const);

export const STARTER_PUBLIC_LIST_FIELD_IDS = Object.freeze([
  "basics.title",
  "details.summary",
] as const);

export function mapStarterExposureSurfaceToFieldPolicySurface(
  surface: string,
): WorkspaceFieldPolicySurface {
  if (surface === STARTER_EXPOSURE_SURFACE.publicList) {
    return "public_website";
  }
  return "delivery";
}

export const STARTER_EXPOSURE_SURFACE_DEFINITIONS = Object.freeze([
  Object.freeze({
    surface: STARTER_EXPOSURE_SURFACE.publicList,
    audience: "public",
    triggerLabel: "always",
    triggerStorageKey: "always",
    defaultFieldIds: STARTER_PUBLIC_LIST_FIELD_IDS,
    operatorSettingsVisible: true,
  }),
] as const);
