import {
  assertWorkspaceOwnerMutation,
  type TenantAuthContext,
  type TenantAuthz,
} from "@app-tour/workspace-sdk";

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
  assertWorkspaceOwnerMutation({
    auth: params.auth,
    workspaceType: params.workspaceType,
    surface: params.surface,
    ...(params.authz === undefined ? {} : { authz: params.authz }),
    canPerform: canPerformDenaliOwnerMutation,
    createOwnerRequiredError: (surface: DenaliOwnerSurface) =>
      new DenaliOwnerRequiredError(surface),
  });
}
