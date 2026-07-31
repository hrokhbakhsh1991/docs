import { createCanPerformWorkspaceOwnerMutation } from "@app-tour/workspace-sdk";

import { URBAN_WORKSPACE_TYPE } from "../urban.plugin";
import {
  URBAN_OWNER_SURFACE_ALLOWLIST,
  type UrbanOwnerSurface,
} from "./urban-owner-surface";

export const canPerformUrbanOwnerMutation = createCanPerformWorkspaceOwnerMutation<UrbanOwnerSurface>({
  requiredWorkspaceType: URBAN_WORKSPACE_TYPE,
  allowedSurfaces: URBAN_OWNER_SURFACE_ALLOWLIST,
});
