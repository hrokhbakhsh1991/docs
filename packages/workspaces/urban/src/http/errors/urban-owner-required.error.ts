import { defineWorkspaceCodedError } from "@app-tour/workspace-sdk";

const defined = defineWorkspaceCodedError({
  code: "URBAN_OWNER_REQUIRED",
  name: "UrbanOwnerRequiredError",
  withSurface: true,
});

export const URBAN_OWNER_REQUIRED = defined.code as "URBAN_OWNER_REQUIRED";
export const UrbanOwnerRequiredError = defined.ErrorClass;
export function isUrbanOwnerRequiredError(
  error: unknown,
): error is InstanceType<typeof UrbanOwnerRequiredError> {
  return defined.isError(error);
}
