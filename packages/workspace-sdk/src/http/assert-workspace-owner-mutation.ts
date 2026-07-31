import { buildTenantAuthz, type TenantAuthContext, type TenantAuthz } from "../auth";

export type AssertWorkspaceOwnerMutationParams<TSurface extends string> = {
  readonly auth: TenantAuthContext;
  readonly workspaceType: string;
  readonly surface: TSurface;
  readonly authz?: TenantAuthz;
  readonly canPerform: (
    authz: TenantAuthz,
    tenantId: string,
    surface: TSurface,
    workspaceType: string,
  ) => boolean;
  readonly createOwnerRequiredError: (surface: TSurface) => Error;
};

/**
 * Shared owner-gate for workspace HTTP mutations (DG-1).
 * Workspaces supply `canPerform` + error factory; no product literals here.
 */
export function assertWorkspaceOwnerMutation<TSurface extends string>(
  params: AssertWorkspaceOwnerMutationParams<TSurface>,
): void {
  let authz = params.authz;
  if (authz === undefined) {
    authz = buildTenantAuthz(params.auth);
  }

  if (
    !params.canPerform(
      authz,
      params.auth.tenantId,
      params.surface,
      params.workspaceType,
    )
  ) {
    throw params.createOwnerRequiredError(params.surface);
  }
}
