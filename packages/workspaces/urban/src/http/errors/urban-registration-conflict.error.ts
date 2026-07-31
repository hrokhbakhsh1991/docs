import { defineWorkspaceCodedError } from "@app-tour/workspace-sdk";

const defined = defineWorkspaceCodedError({
  code: "URBAN_REGISTRATION_DUPLICATE",
  name: "UrbanRegistrationDuplicateError",
  httpStatus: 409,
});

export const URBAN_REGISTRATION_DUPLICATE = defined.code as "URBAN_REGISTRATION_DUPLICATE";
export const UrbanRegistrationDuplicateError = defined.ErrorClass;
export function isUrbanRegistrationDuplicateError(
  error: unknown,
): error is InstanceType<typeof UrbanRegistrationDuplicateError> {
  return defined.isError(error);
}
