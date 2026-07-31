import type { TenantAuthz } from "./tenant-authz";
import type { WorkspaceAuthSurface, WorkspaceOwnerMutationPolicy } from "./workspace-auth-surface";

export type CanPerformWorkspaceOwnerMutation<TSurface extends string> = (
  authz: TenantAuthz,
  tenantId: string,
  surface: TSurface,
  workspaceType: string,
) => boolean;

/**
 * Shared owner-mutation checker factory (DG-1.5).
 * Product workspaces supply required workspace type + surface allowlist only.
 */
export function createCanPerformWorkspaceOwnerMutation<TSurface extends string>(options: {
  readonly requiredWorkspaceType: string;
  readonly allowedSurfaces: ReadonlySet<TSurface>;
}): CanPerformWorkspaceOwnerMutation<TSurface> {
  const policy: WorkspaceOwnerMutationPolicy = {
    requiredWorkspaceType: options.requiredWorkspaceType,
    allowedSurfaces: options.allowedSurfaces as ReadonlySet<WorkspaceAuthSurface>,
  };

  return (authz, tenantId, surface, workspaceType) =>
    authz.canPerformWorkspaceOwnerMutation(tenantId, surface, workspaceType, policy);
}
