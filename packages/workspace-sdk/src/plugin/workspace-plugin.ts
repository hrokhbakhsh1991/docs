export type { WorkspacePlugin } from "./workspace-plugin.contract";

export {
  assertWorkspacePlugin,
  WorkspacePluginValidationError,
  type WorkspacePluginValidationErrorCode,
} from "./workspace-plugin-validation";

import { assertWorkspacePlugin } from "./workspace-plugin-validation";
import type { WorkspacePlugin } from "./workspace-plugin.contract";

/** Shallow structural check — use {@link assertWorkspacePlugin} before runtime use. */
export function isWorkspacePlugin(value: unknown): value is WorkspacePlugin {
  try {
    assertWorkspacePlugin(value);
    return true;
  } catch {
    return false;
  }
}
