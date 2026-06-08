import {
  buildTenantAuthz,
  type TenantAuthContext,
  type TenantAuthz,
  type UrbanOwnerSurface,
} from "@app-tour/workspace-sdk";

import { UrbanOwnerRequiredError } from "./urban-owner-required.error";

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

  let authz = params.authz;
  if (authz === undefined) {
    if (process.env.URBAN_TEST_INJECT_AUTHZ_BUILD_THROW === "1") {
      throw new UrbanOwnerRequiredError(params.surface);
    }
    authz = buildTenantAuthz(params.auth);
  }

  if (
    !authz.canPerformUrbanOwnerMutation(params.auth.tenantId, params.surface, params.workspaceType)
  ) {
    throw new UrbanOwnerRequiredError(params.surface);
  }
}
