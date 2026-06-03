/** Root-level ingress failures before workspace plugin validation. */
export type WorkspacePluginIngressErrorCode = "PLUGIN_INVALID_ROOT";

export class WorkspacePluginIngressError extends Error {
  readonly code: WorkspacePluginIngressErrorCode;

  constructor(message: string) {
    super(message);
    this.name = "WorkspacePluginIngressError";
    this.code = "PLUGIN_INVALID_ROOT";
  }
}
