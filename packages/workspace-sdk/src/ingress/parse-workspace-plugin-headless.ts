import { assertWorkspacePluginCore } from "../plugin/workspace-plugin-validation-core.js";
import type { WorkspacePlugin } from "../plugin/workspace-plugin.contract.js";
import type { SdkResult } from "../errors/sdk-result.js";
import {
  parseWorkspacePluginFromStorageCore,
  tryParseWorkspacePluginFromStorageCore,
  type WorkspacePluginIngressErrorCode,
} from "./parse-workspace-plugin-shared.js";
import type { ParseWorkspacePluginOptions } from "./parse-workspace-plugin.js";

export type { WorkspacePluginIngressErrorCode } from "./parse-workspace-plugin-shared.js";

function assertHeadlessIngressOptions(options?: ParseWorkspacePluginOptions): void {
  if (options?.includeTheme === true) {
    throw new Error(
      "@app-tour/workspace-sdk/ingress only supports headless plugin parse (includeTheme must be false or omitted)",
    );
  }
}

/** Ingress subpath — structural validation only (no theme/CSS validation). */
export function tryParseWorkspacePluginFromStorage(
  raw: unknown,
  options?: ParseWorkspacePluginOptions,
): SdkResult<WorkspacePlugin, WorkspacePluginIngressErrorCode> {
  assertHeadlessIngressOptions(options);
  return tryParseWorkspacePluginFromStorageCore(raw, assertWorkspacePluginCore);
}

export function parseWorkspacePluginFromStorage(
  raw: unknown,
  options?: ParseWorkspacePluginOptions,
): WorkspacePlugin {
  assertHeadlessIngressOptions(options);
  return parseWorkspacePluginFromStorageCore(raw, assertWorkspacePluginCore);
}
