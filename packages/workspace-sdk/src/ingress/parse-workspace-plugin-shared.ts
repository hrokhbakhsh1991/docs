import { sdkErr, sdkOk, type SdkResult } from "../errors/sdk-result";
import {
  IngressSanitizationError,
  type IngressSanitizationErrorCode,
} from "../errors/ingress-sanitization-error";
import { WorkspacePluginIngressError } from "../errors/workspace-plugin-ingress-error";
import {
  isWorkspaceSdkValidationError,
  throwWorkspaceValidationError,
  workspaceSdkValidationErrorCode,
  type WorkspaceSdkValidationError,
  type WorkspaceSdkValidationErrorCode,
} from "../errors/workspace-validation-errors.js";
import type { WorkspacePlugin } from "../plugin/workspace-plugin.contract";
import { createNoopWorkspaceValidationHooks } from "../plugin/workspace-validation";
import { deepCloneFreezeFromStorage } from "./plain-tree";

/**
 * Stored plugin JSON is plain data only — validation hooks are host-injected at runtime (CT-12/33).
 */

export type WorkspacePluginIngressErrorCode =
  | WorkspaceSdkValidationErrorCode
  | IngressSanitizationErrorCode
  | "PLUGIN_INVALID_ROOT";

function rejectInvalidPluginRoot(): SdkResult<never, "PLUGIN_INVALID_ROOT"> {
  return sdkErr("PLUGIN_INVALID_ROOT", "Stored workspace plugin must be a plain object");
}

function throwPluginIngressFailure(
  result: SdkResult<WorkspacePlugin, WorkspacePluginIngressErrorCode> & { ok: false },
): never {
  const { code, message, path } = result.error;
  if (code === "PLUGIN_INVALID_ROOT") {
    throw new WorkspacePluginIngressError(message);
  }
  if (
    code === "NON_OBJECT_ROOT" ||
    code === "ROOT_IS_ARRAY" ||
    code === "MAX_DEPTH_EXCEEDED" ||
    code === "FUNCTION_NOT_ALLOWED" ||
    code === "BIGINT_NOT_ALLOWED" ||
    code === "SYMBOL_NOT_ALLOWED" ||
    code === "UNSUPPORTED_PRIMITIVE" ||
    code === "ACCESSOR_PROPERTY" ||
    code === "NON_DATA_DESCRIPTOR" ||
    code === "MISSING_DESCRIPTOR" ||
    code === "PROTOTYPE_INTROSPECTION_TRAP" ||
    code === "UNSTABLE_PROTOTYPE" ||
    code === "NON_PLAIN_PROTOTYPE" ||
    code === "SYMBOL_KEYS" ||
    code === "HIDDEN_NON_ENUMERABLE_KEYS" ||
    code === "ARRAY_NOT_ALLOWED" ||
    code === "ARRAY_LIKE_OBJECT" ||
    code === "INGRESS_REJECTED"
  ) {
    throw new IngressSanitizationError(code, message, path ?? "plugin");
  }
  throwWorkspaceValidationError(code as WorkspaceSdkValidationErrorCode, message);
}

function sdkErrFromValidationError(error: WorkspaceSdkValidationError): SdkResult<never, WorkspaceSdkValidationErrorCode> {
  return sdkErr(workspaceSdkValidationErrorCode(error), error.message);
}

export function tryParseWorkspacePluginFromStorageCore(
  raw: unknown,
  assertPlugin: (plugin: WorkspacePlugin) => void,
): SdkResult<WorkspacePlugin, WorkspacePluginIngressErrorCode> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return rejectInvalidPluginRoot();
  }

  const record = raw as Record<string, unknown>;
  const dataOnly: Record<string, unknown> = { ...record };
  delete dataOnly.validation;

  let sanitized: WorkspacePlugin;
  try {
    sanitized = deepCloneFreezeFromStorage<WorkspacePlugin>(dataOnly, "plugin", {
      allowArrays: true,
      allowFunctions: false,
    });
  } catch (error: unknown) {
    if (isWorkspaceSdkValidationError(error)) {
      return sdkErrFromValidationError(error);
    }
    if (error instanceof IngressSanitizationError) {
      return sdkErr(error.code, error.message, error.path);
    }
    return sdkErr(
      "INGRESS_REJECTED",
      error instanceof Error ? error.message : String(error),
      "plugin",
    );
  }

  const pluginForAssert: WorkspacePlugin = {
    ...sanitized,
    validation: createNoopWorkspaceValidationHooks(),
  };

  try {
    assertPlugin(pluginForAssert);
  } catch (error: unknown) {
    if (isWorkspaceSdkValidationError(error)) {
      return sdkErrFromValidationError(error);
    }
    return sdkErr("PLUGIN_INVALID_SHAPE", error instanceof Error ? error.message : String(error));
  }

  return sdkOk(Object.freeze(pluginForAssert));
}

export function parseWorkspacePluginFromStorageCore(
  raw: unknown,
  assertPlugin: (plugin: WorkspacePlugin) => void,
): WorkspacePlugin {
  const result = tryParseWorkspacePluginFromStorageCore(raw, assertPlugin);
  if (!result.ok) {
    throwPluginIngressFailure(result);
  }
  return result.value;
}
