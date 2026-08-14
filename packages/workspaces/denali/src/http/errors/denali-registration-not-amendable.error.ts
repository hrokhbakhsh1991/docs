import { defineWorkspaceCodedError } from "@app-tour/workspace-sdk";

const defined = defineWorkspaceCodedError({
  code: "DENALI_REGISTRATION_NOT_AMENDABLE",
  name: "DenaliRegistrationNotAmendableError",
  httpStatus: 409,
});

export const DENALI_REGISTRATION_NOT_AMENDABLE =
  defined.code as "DENALI_REGISTRATION_NOT_AMENDABLE";
export const DenaliRegistrationNotAmendableError = defined.ErrorClass;
export function isDenaliRegistrationNotAmendableError(
  error: unknown,
): error is InstanceType<typeof DenaliRegistrationNotAmendableError> {
  return defined.isError(error);
}
