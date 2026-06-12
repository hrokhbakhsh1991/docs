import { assertDenaliWorkspaceOwner } from "@app-tour/workspace-denali/http";
import { assertWorkspaceOwner } from "@app-tour/workspace-urban/http";
import type { UrbanOwnerSurface } from "@app-tour/workspace-urban/auth";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

export function assertTourPublishFieldOwner(input: {
  readonly auth: TenantAuthContext;
  readonly workspaceType: string;
  readonly surface: string;
}): void {
  if (input.workspaceType === "urban") {
    assertWorkspaceOwner({
      auth: input.auth,
      workspaceType: input.workspaceType,
      surface: input.surface as UrbanOwnerSurface,
    });
    return;
  }
  if (input.workspaceType === "denali") {
    assertDenaliWorkspaceOwner({
      auth: input.auth,
      workspaceType: input.workspaceType,
      surface: input.surface as "denali.tour.publish_fields",
    });
  }
}
