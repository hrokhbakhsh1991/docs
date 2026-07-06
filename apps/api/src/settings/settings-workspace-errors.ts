/** @deprecated Phase C — registry gates replace workspace-type guards; kept for route error mapping. */
export class SettingsWorkspaceForbiddenError extends Error {
  readonly code = "SETTINGS_WORKSPACE_FORBIDDEN" as const;

  constructor() {
    super("SETTINGS_WORKSPACE_FORBIDDEN");
    this.name = "SettingsWorkspaceForbiddenError";
  }
}
