import { defineWorkspaceCodedError } from "@app-tour/workspace-sdk";

const defined = defineWorkspaceCodedError({
  code: "DENALI_OWNER_REQUIRED",
  name: "DenaliOwnerRequiredError",
  withSurface: true,
});

export const DENALI_OWNER_REQUIRED = defined.code as "DENALI_OWNER_REQUIRED";
export const DenaliOwnerRequiredError = defined.ErrorClass;
export function isDenaliOwnerRequiredError(
  error: unknown,
): error is InstanceType<typeof DenaliOwnerRequiredError> {
  return defined.isError(error);
}
