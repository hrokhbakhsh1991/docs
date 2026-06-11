import type { TenantAuthz } from "@app-tour/workspace-sdk";

import { URBAN_WORKSPACE_TYPE } from "../urban.plugin";
import {
  URBAN_OWNER_SURFACE_ALLOWLIST,
  type UrbanOwnerSurface,
} from "./urban-owner-surface";

const URBAN_OWNER_MUTATION_POLICY = {
  requiredWorkspaceType: URBAN_WORKSPACE_TYPE,
  allowedSurfaces: URBAN_OWNER_SURFACE_ALLOWLIST,
} as const;

export function canPerformUrbanOwnerMutation(
  authz: TenantAuthz,
  tenantId: string,
  surface: UrbanOwnerSurface,
  workspaceType: string
): boolean {
  return authz.canPerformWorkspaceOwnerMutation(
    tenantId,
    surface,
    workspaceType,
    URBAN_OWNER_MUTATION_POLICY
  );
}
