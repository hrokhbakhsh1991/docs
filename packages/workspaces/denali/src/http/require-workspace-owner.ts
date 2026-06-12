import { buildTenantAuthz, type TenantAuthContext, type TenantAuthz } from "@app-tour/workspace-sdk";

import { canPerformDenaliOwnerMutation } from "../auth/denali-owner-auth";
import type { DenaliOwnerSurface } from "../auth/denali-owner-surface";

import { DenaliOwnerRequiredError } from "./errors/denali-owner-required.error";

export type AssertDenaliWorkspaceOwnerParams = {
  readonly auth: TenantAuthContext;
  readonly workspaceType: string;
  readonly surface: DenaliOwnerSurface;
  readonly authz?: TenantAuthz;
};

export function assertDenaliWorkspaceOwner(params: AssertDenaliWorkspaceOwnerParams): void {
  let authz = params.authz;
  if (authz === undefined) {
    authz = buildTenantAuthz(params.auth);
  }

  if (
    !canPerformDenaliOwnerMutation(
      authz,
      params.auth.tenantId,
      params.surface,
      params.workspaceType
    )
  ) {
    throw new DenaliOwnerRequiredError(params.surface);
  }
}
