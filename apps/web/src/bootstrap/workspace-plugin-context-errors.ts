/**
 * Fail-closed workspace identity errors for apps/web resolvers (Thin Shell Phase 1).
 * Do not invent product defaults when context is missing.
 */

export class WorkspaceContextMissingError extends Error {
  readonly code = "WORKSPACE_CONTEXT_MISSING" as const;

  constructor(message = "Workspace pluginId is required") {
    super(message);
    this.name = "WorkspaceContextMissingError";
  }
}

export class WorkspacePluginNotFoundError extends Error {
  readonly code = "WORKSPACE_PLUGIN_NOT_FOUND" as const;
  readonly pluginId: string;

  constructor(pluginId: string, message?: string) {
    super(message ?? `WORKSPACE_PLUGIN_NOT_FOUND:${pluginId}`);
    this.name = "WorkspacePluginNotFoundError";
    this.pluginId = pluginId;
  }
}

/** Trim and require a non-empty plugin id — never default to a product. */
export function requireWorkspacePluginId(
  pluginId: string | null | undefined
): string {
  const id = typeof pluginId === "string" ? pluginId.trim() : "";
  if (id.length === 0) {
    throw new WorkspaceContextMissingError();
  }
  return id;
}

export function isWorkspacePluginNotFoundMessage(message: string): boolean {
  return message.startsWith("WORKSPACE_PLUGIN_NOT_FOUND:");
}
