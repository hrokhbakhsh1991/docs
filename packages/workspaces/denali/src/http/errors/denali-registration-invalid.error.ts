import { defineWorkspaceCodedError } from "@app-tour/workspace-sdk";

const defined = defineWorkspaceCodedError({
  code: "DENALI_REGISTRATION_INVALID",
  name: "DenaliRegistrationInvalidError",
  httpStatus: 400,
});

export const DENALI_REGISTRATION_INVALID = defined.code as "DENALI_REGISTRATION_INVALID";
export const DenaliRegistrationInvalidError = defined.ErrorClass;
export function isDenaliRegistrationInvalidError(
  error: unknown,
): error is InstanceType<typeof DenaliRegistrationInvalidError> {
  return defined.isError(error);
}
