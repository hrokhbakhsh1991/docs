import type { TenantAuthz } from "@app-tour/workspace-sdk";

import { DENALI_WORKSPACE_TYPE } from "../denali.plugin";
import {
  DENALI_OWNER_SURFACE_ALLOWLIST,
  type DenaliOwnerSurface,
} from "./denali-owner-surface";

const DENALI_OWNER_MUTATION_POLICY = {
  requiredWorkspaceType: DENALI_WORKSPACE_TYPE,
  allowedSurfaces: DENALI_OWNER_SURFACE_ALLOWLIST,
} as const;

export function canPerformDenaliOwnerMutation(
  authz: TenantAuthz,
  tenantId: string,
  surface: DenaliOwnerSurface,
  workspaceType: string
): boolean {
  return authz.canPerformWorkspaceOwnerMutation(
    tenantId,
    surface,
    workspaceType,
    DENALI_OWNER_MUTATION_POLICY
  );
}
