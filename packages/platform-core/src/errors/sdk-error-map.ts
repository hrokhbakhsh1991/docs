import {
  assertWorkspacePluginCore,
  IngressSanitizationError,
  WorkspacePluginIngressError,
  isWorkspaceSdkValidationError,
  workspaceSdkValidationErrorCode,
  type WorkspaceSdkValidationError,
  type WorkspaceSdkValidationErrorCode,
} from "@app-tour/workspace-sdk/ingress";

import { INGRESS_SANITIZATION_TO_PLATFORM } from "./ingress-sanitization-map";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";

import {
  PlatformCoreError,
  type PlatformCoreErrorCode,
} from "./platform-core.error";
import {
  platformErr,
  platformOk,
  unwrapPlatformResult,
  type PlatformResult,
} from "./platform-result";

const THEME_SDK_VALIDATION_CODES = new Set<WorkspaceSdkValidationErrorCode>([
  "TENANT_INVALID_SHAPE",
  "INVALID_THEME_ID",
  "INVALID_THEME_VERSION",
  "THEME_CSS_VARIABLE_LIMIT",
  "INVALID_THEME_CSS_KEY",
  "INVALID_THEME_CSS_VALUE",
  "UNSAFE_THEME_CSS_VALUE",
  "INVALID_THEME_STYLESHEET",
  "UNSEALED_THEME",
]);

const SDK_TO_PLATFORM_CODE: Partial<
  Record<WorkspaceSdkValidationErrorCode, PlatformCoreErrorCode>
> = {
  PLUGIN_INVALID_SHAPE: "PLUGIN_INVALID_SHAPE",
  PLUGIN_FUNCTION_NOT_ALLOWED: "PLUGIN_FUNCTION_NOT_ALLOWED",
  UNKNOWN_FIELD_ID: "UNKNOWN_FIELD_ID",
  DUPLICATE_FIELD_ID: "DUPLICATE_FIELD_ID",
  DUPLICATE_CANONICAL_PATH: "DUPLICATE_CANONICAL_PATH",
  INVALID_FIELD_REGISTRY: "INVALID_FIELD_REGISTRY",
  DUPLICATE_CELL_ID: "DUPLICATE_CELL_ID",
  INVALID_RULE_SET: "INVALID_RULE_SET",
  INVALID_WIZARD_SURFACE: "INVALID_WIZARD_SURFACE",
  INVALID_VALIDATION_HOOKS: "INVALID_VALIDATION_HOOKS",
  INVALID_LIFECYCLE: "INVALID_LIFECYCLE",
  CYCLE_DETECTED: "INVALID_LIFECYCLE",
  UNREACHABLE_PUBLISH: "INVALID_LIFECYCLE",
  ORPHAN_STATE: "INVALID_LIFECYCLE",
};

function mapSdkValidationCodeToPlatform(
  code: WorkspaceSdkValidationErrorCode,
): PlatformCoreErrorCode {
  if (THEME_SDK_VALIDATION_CODES.has(code)) {
    return "PLUGIN_INVALID_SHAPE";
  }
  const platformCode = SDK_TO_PLATFORM_CODE[code];
  if (platformCode != null) {
    return platformCode;
  }
  return "PLUGIN_INVALID_SHAPE";
}

export function mapWorkspaceSdkValidationError(
  error: WorkspaceSdkValidationError,
): PlatformCoreError {
  const code = workspaceSdkValidationErrorCode(error);
  const platformCode = mapSdkValidationCodeToPlatform(code);
  return new PlatformCoreError(platformCode, error.message, { sdkCode: code });
}

export function mapPluginIngressFailure(error: unknown): PlatformResult<never> | null {
  if (isWorkspaceSdkValidationError(error)) {
    return platformErr(mapWorkspaceSdkValidationError(error));
  }
  if (error instanceof WorkspacePluginIngressError) {
    return platformErr(
      new PlatformCoreError("PLUGIN_INVALID_ROOT", error.message, {
        ingressCode: error.code,
      }),
    );
  }
  if (error instanceof IngressSanitizationError) {
    const platformCode = INGRESS_SANITIZATION_TO_PLATFORM[error.code];
    return platformErr(
      new PlatformCoreError(platformCode, error.message, {
        ingressCode: error.code,
        path: error.path,
        surface: "plugin",
      }),
    );
  }
  return null;
}

export function tryValidateWorkspacePluginForPlatform(
  value: unknown,
): PlatformResult<WorkspacePlugin> {
  try {
    assertWorkspacePluginCore(value);
    return platformOk(value as WorkspacePlugin);
  } catch (error: unknown) {
    const mapped = mapPluginIngressFailure(error);
    if (mapped != null) {
      return mapped;
    }
    throw error;
  }
}

export function assertWorkspacePluginForPlatform(value: unknown): void {
  unwrapPlatformResult(tryValidateWorkspacePluginForPlatform(value));
}
