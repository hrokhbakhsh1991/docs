import {
  assertWorkspaceOwnerMutation,
  type TenantAuthContext,
  type TenantAuthz,
} from "@app-tour/workspace-sdk";
import { canPerformUrbanOwnerMutation, type UrbanOwnerSurface } from "../auth";

import { UrbanOwnerRequiredError } from "./errors/urban-owner-required.error";

export type AssertWorkspaceOwnerParams = {
  readonly auth: TenantAuthContext;
  readonly workspaceType: string;
  readonly surface: UrbanOwnerSurface;
  readonly authz?: TenantAuthz;
};

export function assertWorkspaceOwner(params: AssertWorkspaceOwnerParams): void {
  if (process.env.URBAN_TEST_INJECT_ASSERT_OWNER_THROW === "1") {
    throw new Error("INTERNAL_SERVER_ERROR");
  }

  if (params.authz === undefined && process.env.URBAN_TEST_INJECT_AUTHZ_BUILD_THROW === "1") {
    throw new UrbanOwnerRequiredError(params.surface);
  }

  assertWorkspaceOwnerMutation({
    auth: params.auth,
    workspaceType: params.workspaceType,
    surface: params.surface,
    ...(params.authz === undefined ? {} : { authz: params.authz }),
    canPerform: canPerformUrbanOwnerMutation,
    createOwnerRequiredError: (surface: UrbanOwnerSurface) =>
      new UrbanOwnerRequiredError(surface),
  });
}
