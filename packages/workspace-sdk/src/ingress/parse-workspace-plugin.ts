import { assertWorkspacePlugin, type WorkspacePlugin } from "../plugin/workspace-plugin";
import { deepCloneFreezeFromStorage } from "./ingress-storage-sanitizer";

export function parseWorkspacePluginFromStorage(raw: unknown): WorkspacePlugin {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Stored workspace plugin must be a plain object");
  }

  const sanitized = deepCloneFreezeFromStorage<WorkspacePlugin>(raw, "plugin", {
    allowArrays: true,
    allowFunctions: true,
  });
  assertWorkspacePlugin(sanitized);
  return Object.freeze(sanitized);
}
