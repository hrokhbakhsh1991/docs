export type { WorkspacePlugin } from "./workspace-plugin.contract";

export {
  throwWorkspaceValidationError,
  isWorkspaceSdkValidationError,
  WorkspaceHooksValidationError,
  WorkspaceLifecycleValidationError,
  WorkspacePluginShapeError,
  WorkspaceRegistryValidationError,
  WorkspaceRuleSetValidationError,
  WorkspaceThemeValidationError,
  WorkspaceWizardValidationError,
  type WorkspaceSdkValidationError,
  type WorkspaceSdkValidationErrorCode,
  type WorkspacePluginValidationErrorCode,
} from "./workspace-plugin-validation-core";

import { sdkErr, sdkOk, type SdkResult } from "../errors/sdk-result";
import {
  isWorkspaceSdkValidationError,
  throwWorkspaceValidationError,
  type WorkspaceSdkValidationError,
  type WorkspaceSdkValidationErrorCode,
} from "../errors/workspace-validation-errors.js";
import { assertWorkspacePluginCore } from "./workspace-plugin-validation-core";
import type { WorkspacePlugin } from "./workspace-plugin.contract";

/** Returns the validation error for a rejected value, or null when valid. */
export function explainWorkspacePluginRejection(
  value: unknown,
): WorkspaceSdkValidationError | null {
  try {
    assertWorkspacePluginCore(value);
    return null;
  } catch (error: unknown) {
    if (isWorkspaceSdkValidationError(error)) {
      return error;
    }
    throwWorkspaceValidationError(
      "PLUGIN_INVALID_SHAPE",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** Non-throwing structural validation (core only — no theme CSS stack). */
export function validateWorkspacePlugin(
  value: unknown,
): SdkResult<WorkspacePlugin, WorkspaceSdkValidationErrorCode> {
  const rejection = explainWorkspacePluginRejection(value);
  if (rejection != null) {
    return sdkErr(rejection.code, rejection.message);
  }
  return sdkOk(value as WorkspacePlugin);
}

/** Shallow structural check (core only — no theme CSS stack at import time). */
export function isWorkspacePlugin(value: unknown): value is WorkspacePlugin {
  return validateWorkspacePlugin(value).ok;
}
