import {
  isWorkspaceAuthSurfaceInAllowlist,
  type WorkspaceAuthSurface,
} from "@app-tour/workspace-sdk";

export type DenaliOwnerSurface = "denali.tour.publish_fields" | "denali.tour.mutation_override";

export const DENALI_OWNER_SURFACE_ALLOWLIST: ReadonlySet<DenaliOwnerSurface> = new Set([
  "denali.tour.publish_fields",
  "denali.tour.mutation_override",
]);

export function isDenaliOwnerSurface(surface: WorkspaceAuthSurface): surface is DenaliOwnerSurface {
  return isWorkspaceAuthSurfaceInAllowlist(surface, DENALI_OWNER_SURFACE_ALLOWLIST);
}
