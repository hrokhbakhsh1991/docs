import { defineWorkspaceCodedError } from "@app-tour/workspace-sdk";

const defined = defineWorkspaceCodedError({
  code: "DENALI_REGISTRATION_DUPLICATE",
  name: "DenaliRegistrationDuplicateError",
  httpStatus: 409,
});

export const DENALI_REGISTRATION_DUPLICATE = defined.code as "DENALI_REGISTRATION_DUPLICATE";
export const DenaliRegistrationDuplicateError = defined.ErrorClass;
export function isDenaliRegistrationDuplicateError(
  error: unknown,
): error is InstanceType<typeof DenaliRegistrationDuplicateError> {
  return defined.isError(error);
}
