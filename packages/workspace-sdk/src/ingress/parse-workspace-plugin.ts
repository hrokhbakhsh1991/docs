import { assertWorkspacePlugin, type WorkspacePlugin } from "../plugin/workspace-plugin";

export function parseWorkspacePluginFromStorage(raw: unknown): WorkspacePlugin {
  assertWorkspacePlugin(raw);
  return raw;
}
