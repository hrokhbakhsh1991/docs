import { defineWorkspaceCodedError } from "@app-tour/workspace-sdk";

const defined = defineWorkspaceCodedError({
  code: "HARBOR_WORKSPACE_REQUIRED",
  name: "HarborWorkspaceRequiredError",
  httpStatus: 404,
});

export const HARBOR_WORKSPACE_REQUIRED = defined.code as "HARBOR_WORKSPACE_REQUIRED";
export const HarborWorkspaceRequiredError = defined.ErrorClass;
export function isHarborWorkspaceRequiredError(
  error: unknown,
): error is InstanceType<typeof HarborWorkspaceRequiredError> {
  return defined.isError(error);
}
