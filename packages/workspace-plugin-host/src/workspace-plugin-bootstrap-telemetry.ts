/** Stable codes for per-plugin bootstrap load / registration failures. */
export type WorkspacePluginBootstrapFailureCode =
  | "WORKSPACE_PLUGIN_LOAD_FAILED"
  | "WORKSPACE_PLUGIN_REGISTER_UNKNOWN";

export type WorkspacePluginBootstrapTelemetryEvent = Readonly<{
  readonly kind: "workspacePluginBootstrapStatus";
  readonly pluginId: string;
  readonly status: "ready" | "failed";
  readonly code: WorkspacePluginBootstrapFailureCode | "WORKSPACE_PLUGIN_LOAD_OK";
  readonly message?: string;
}>;

let telemetrySink: ((event: WorkspacePluginBootstrapTelemetryEvent) => void) | undefined;

/** Host wiring — forward bootstrap status to observability (logger, metrics, tracing). */
export function setWorkspacePluginBootstrapTelemetrySink(
  sink: ((event: WorkspacePluginBootstrapTelemetryEvent) => void) | undefined,
): void {
  telemetrySink = sink;
}

/** @internal test-only */
export function resetWorkspacePluginBootstrapTelemetryForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    return;
  }
  telemetrySink = undefined;
}

export function emitWorkspacePluginBootstrapTelemetry(
  event: WorkspacePluginBootstrapTelemetryEvent,
): void {
  telemetrySink?.(event);
}

export function workspacePluginBootstrapStateToTelemetry(
  state: Readonly<{ readonly status: "ready" | "failed"; readonly pluginId: string; readonly error?: string }>,
): WorkspacePluginBootstrapTelemetryEvent {
  if (state.status === "ready") {
    return {
      kind: "workspacePluginBootstrapStatus",
      pluginId: state.pluginId,
      status: "ready",
      code: "WORKSPACE_PLUGIN_LOAD_OK",
    };
  }

  const message = state.error ?? "unknown";
  const code: WorkspacePluginBootstrapFailureCode = message.includes(
    "WORKSPACE_PLUGIN_REGISTER_UNKNOWN",
  )
    ? "WORKSPACE_PLUGIN_REGISTER_UNKNOWN"
    : "WORKSPACE_PLUGIN_LOAD_FAILED";

  return {
    kind: "workspacePluginBootstrapStatus",
    pluginId: state.pluginId,
    status: "failed",
    code,
    message,
  };
}

export function reportWorkspacePluginBootstrapStatus(
  state: Readonly<{ readonly status: "ready" | "failed"; readonly pluginId: string; readonly error?: string }>,
): void {
  emitWorkspacePluginBootstrapTelemetry(workspacePluginBootstrapStateToTelemetry(state));
}
