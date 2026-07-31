import { defineWorkspaceCodedError } from "@app-tour/workspace-sdk";

const defined = defineWorkspaceCodedError({
  code: "URBAN_WORKSPACE_REQUIRED",
  name: "UrbanWorkspaceRequiredError",
  httpStatus: 404,
});

export const URBAN_WORKSPACE_REQUIRED = defined.code as "URBAN_WORKSPACE_REQUIRED";
export const UrbanWorkspaceRequiredError = defined.ErrorClass;
export function isUrbanWorkspaceRequiredError(
  error: unknown,
): error is InstanceType<typeof UrbanWorkspaceRequiredError> {
  return defined.isError(error);
}
