import { WorkspaceRegistry } from "./workspace-registry";

/** Process-wide registry — empty until {@link workspaceRegistry.load}. */
export const workspaceRegistry = new WorkspaceRegistry();
