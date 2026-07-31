import { defineWorkspaceCodedError } from "@app-tour/workspace-sdk";

const defined = defineWorkspaceCodedError({
  code: "DENALI_WORKSPACE_REQUIRED",
  name: "DenaliWorkspaceRequiredError",
});

export const DENALI_WORKSPACE_REQUIRED = defined.code as "DENALI_WORKSPACE_REQUIRED";
export const DenaliWorkspaceRequiredError = defined.ErrorClass;
