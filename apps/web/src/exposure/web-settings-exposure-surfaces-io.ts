import type { SettingsExposureSurfacesIo } from "@/features/settings/settings-exposure-surfaces-ui-types";
import {
  fetchWorkspaceExposureSurfaces,
  patchWorkspaceSurfaceExposureIntent,
} from "@/exposure/workspace-exposure-surfaces-client";

/**
 * Web BFF adapter for SettingsExposureSurfacesIo (H1.c.1).
 * Keeps `/api/workspaces/.../exposure/surfaces` out of the panel / future package surface.
 */
export const webSettingsExposureSurfacesIo: SettingsExposureSurfacesIo = Object.freeze({
  loadSurfaces: async (workspaceId) => {
    const payload = await fetchWorkspaceExposureSurfaces(workspaceId);
    return { surfaces: payload.surfaces };
  },
  saveSurfaceIntent: patchWorkspaceSurfaceExposureIntent,
});
