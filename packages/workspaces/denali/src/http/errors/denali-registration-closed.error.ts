import { defineWorkspaceCodedError } from "@app-tour/workspace-sdk";

const defined = defineWorkspaceCodedError({
  code: "DENALI_REGISTRATION_CLOSED",
  name: "DenaliRegistrationClosedError",
  httpStatus: 409,
});

export const DENALI_REGISTRATION_CLOSED = defined.code as "DENALI_REGISTRATION_CLOSED";
export const DenaliRegistrationClosedError = defined.ErrorClass;
export function isDenaliRegistrationClosedError(
  error: unknown
): error is InstanceType<typeof DenaliRegistrationClosedError> {
  return defined.isError(error);
}
