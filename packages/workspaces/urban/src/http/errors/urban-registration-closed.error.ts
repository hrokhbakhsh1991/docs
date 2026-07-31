import { defineWorkspaceCodedError, isWorkspaceCodedError } from "@app-tour/workspace-sdk";

const defined = defineWorkspaceCodedError({
  code: "URBAN_REGISTRATION_CLOSED",
  name: "UrbanRegistrationClosedError",
});

export const URBAN_REGISTRATION_CLOSED = defined.code as "URBAN_REGISTRATION_CLOSED";
export const UrbanRegistrationClosedError = defined.ErrorClass;

export function isUrbanRegistrationClosedError(
  error: unknown,
): error is InstanceType<typeof UrbanRegistrationClosedError> {
  return (
    defined.isError(error) ||
    (error instanceof Error && error.message === URBAN_REGISTRATION_CLOSED) ||
    isWorkspaceCodedError(error, URBAN_REGISTRATION_CLOSED)
  );
}
