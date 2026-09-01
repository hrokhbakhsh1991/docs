import { defineWorkspaceCodedError } from "@app-tour/workspace-sdk";

const duplicateDefined = defineWorkspaceCodedError({
  code: "HARBOR_REGISTRATION_DUPLICATE",
  name: "HarborRegistrationDuplicateError",
  httpStatus: 409,
});

export const HARBOR_REGISTRATION_DUPLICATE =
  duplicateDefined.code as "HARBOR_REGISTRATION_DUPLICATE";
export const HarborRegistrationDuplicateError = duplicateDefined.ErrorClass;
export function isHarborRegistrationDuplicateError(
  error: unknown,
): error is InstanceType<typeof HarborRegistrationDuplicateError> {
  return duplicateDefined.isError(error);
}

const workspaceRequiredDefined = defineWorkspaceCodedError({
  code: "HARBOR_WORKSPACE_REQUIRED",
  name: "HarborWorkspaceRequiredError",
  httpStatus: 404,
});

export const HARBOR_WORKSPACE_REQUIRED =
  workspaceRequiredDefined.code as "HARBOR_WORKSPACE_REQUIRED";
export const HarborWorkspaceRequiredError = workspaceRequiredDefined.ErrorClass;
export function isHarborWorkspaceRequiredError(
  error: unknown,
): error is InstanceType<typeof HarborWorkspaceRequiredError> {
  return workspaceRequiredDefined.isError(error);
}
