import {
  assertWorkspacePlugin,
  WorkspacePluginValidationError,
  type WorkspacePluginValidationErrorCode,
} from "@app-tour/workspace-sdk";

import {
  PlatformCoreError,
  type PlatformCoreErrorCode,
} from "../errors/platform-core.error";

const SDK_TO_PLATFORM_CODE: Record<
  WorkspacePluginValidationErrorCode,
  PlatformCoreErrorCode
> = {
  PLUGIN_INVALID_SHAPE: "PLUGIN_INVALID_SHAPE",
  UNKNOWN_FIELD_ID: "UNKNOWN_FIELD_ID",
  DUPLICATE_FIELD_ID: "DUPLICATE_FIELD_ID",
  DUPLICATE_CANONICAL_PATH: "DUPLICATE_CANONICAL_PATH",
  INVALID_FIELD_REGISTRY: "INVALID_FIELD_REGISTRY",
  DUPLICATE_CELL_ID: "DUPLICATE_CELL_ID",
  INVALID_RULE_SET: "INVALID_RULE_SET",
  INVALID_WIZARD_SURFACE: "INVALID_WIZARD_SURFACE",
  INVALID_VALIDATION_HOOKS: "INVALID_VALIDATION_HOOKS",
  INVALID_LIFECYCLE: "INVALID_LIFECYCLE",
};

export function mapWorkspacePluginValidationError(
  error: WorkspacePluginValidationError,
): PlatformCoreError {
  const code = SDK_TO_PLATFORM_CODE[error.code];
  if (code == null) {
    return new PlatformCoreError(
      "PLUGIN_INVALID_SHAPE",
      `Unmapped workspace SDK error code: ${error.code} — ${error.message}`,
      { sdkCode: error.code },
    );
  }
  return new PlatformCoreError(code, error.message, { sdkCode: error.code });
}

export function assertWorkspacePluginForPlatform(value: unknown): void {
  try {
    assertWorkspacePlugin(value);
  } catch (error) {
    if (error instanceof WorkspacePluginValidationError) {
      throw mapWorkspacePluginValidationError(error);
    }
    throw error;
  }
}
