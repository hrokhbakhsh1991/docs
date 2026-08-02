import { defineWorkspaceCodedError } from "@app-tour/workspace-sdk";

const defined = defineWorkspaceCodedError({
  code: "HARBOR_REGISTRATION_DUPLICATE",
  name: "HarborRegistrationDuplicateError",
  httpStatus: 409,
});

export const HARBOR_REGISTRATION_DUPLICATE =
  defined.code as "HARBOR_REGISTRATION_DUPLICATE";
export const HarborRegistrationDuplicateError = defined.ErrorClass;
export function isHarborRegistrationDuplicateError(
  error: unknown,
): error is InstanceType<typeof HarborRegistrationDuplicateError> {
  return defined.isError(error);
}
