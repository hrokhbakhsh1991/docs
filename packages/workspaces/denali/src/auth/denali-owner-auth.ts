import { createCanPerformWorkspaceOwnerMutation } from "@app-tour/workspace-sdk";

import { DENALI_WORKSPACE_TYPE } from "../denali-identity";
import {
  DENALI_OWNER_SURFACE_ALLOWLIST,
  type DenaliOwnerSurface,
} from "./denali-owner-surface";

export const canPerformDenaliOwnerMutation =
  createCanPerformWorkspaceOwnerMutation<DenaliOwnerSurface>({
    requiredWorkspaceType: DENALI_WORKSPACE_TYPE,
    allowedSurfaces: DENALI_OWNER_SURFACE_ALLOWLIST,
  });
