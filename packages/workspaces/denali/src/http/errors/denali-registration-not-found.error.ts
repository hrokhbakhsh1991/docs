import { defineWorkspaceCodedError } from "@app-tour/workspace-sdk";

const defined = defineWorkspaceCodedError({
  code: "DENALI_REGISTRATION_NOT_FOUND",
  name: "DenaliRegistrationNotFoundError",
  httpStatus: 404,
});

export const DENALI_REGISTRATION_NOT_FOUND = defined.code as "DENALI_REGISTRATION_NOT_FOUND";
export const DenaliRegistrationNotFoundError = defined.ErrorClass;
export function isDenaliRegistrationNotFoundError(
  error: unknown,
): error is InstanceType<typeof DenaliRegistrationNotFoundError> {
  return defined.isError(error);
}
