import { assertWorkspacePlugin } from "../plugin/workspace-plugin-validation.js";
import { assertWorkspacePluginCore } from "../plugin/workspace-plugin-validation-core.js";
import type { WorkspacePlugin } from "../plugin/workspace-plugin.contract.js";
import type { SdkResult } from "../errors/sdk-result.js";
import {
  parseWorkspacePluginFromStorageCore,
  tryParseWorkspacePluginFromStorageCore,
  type WorkspacePluginIngressErrorCode,
} from "./parse-workspace-plugin-shared.js";

export type { WorkspacePluginIngressErrorCode } from "./parse-workspace-plugin-shared.js";

export type ParseWorkspacePluginOptions = {
  /** When false, skips theme/CSS validation (platform-core ingress). Default true. */
  readonly includeTheme?: boolean;
};

function assertPluginForOptions(
  options: ParseWorkspacePluginOptions | undefined,
): (plugin: WorkspacePlugin) => void {
  if (options?.includeTheme === false) {
    return assertWorkspacePluginCore;
  }
  return assertWorkspacePlugin;
}

export function tryParseWorkspacePluginFromStorage(
  raw: unknown,
  options?: ParseWorkspacePluginOptions,
): SdkResult<WorkspacePlugin, WorkspacePluginIngressErrorCode> {
  return tryParseWorkspacePluginFromStorageCore(raw, assertPluginForOptions(options));
}

export function parseWorkspacePluginFromStorage(
  raw: unknown,
  options?: ParseWorkspacePluginOptions,
): WorkspacePlugin {
  return parseWorkspacePluginFromStorageCore(raw, assertPluginForOptions(options));
}
