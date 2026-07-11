/** Stable failure codes for workspace registry load / manifest ingress. */
export type WorkspaceRegistryFailureCode =
  | "WORKSPACE_MANIFEST_INVALID"
  | "WORKSPACE_MANIFEST_ID_MISMATCH"
  | "WORKSPACE_MANIFEST_PATH_INVALID"
  | "WORKSPACE_MANIFEST_DISCOVERY_EMPTY"
  | "WORKSPACE_MANIFEST_DIR_MISSING"
  | "WORKSPACE_REGISTRY_DUPLICATE_ID"
  | "WORKSPACE_REGISTRY_UNKNOWN"
  | "WORKSPACE_REGISTRY_LOAD_FAILED";

export type WorkspaceRegistryTelemetryEvent = Readonly<{
  readonly code: WorkspaceRegistryFailureCode;
  readonly message: string;
  readonly context?: string;
}>;

const KNOWN_CODES: readonly WorkspaceRegistryFailureCode[] = [
  "WORKSPACE_MANIFEST_INVALID",
  "WORKSPACE_MANIFEST_ID_MISMATCH",
  "WORKSPACE_MANIFEST_PATH_INVALID",
  "WORKSPACE_MANIFEST_DISCOVERY_EMPTY",
  "WORKSPACE_MANIFEST_DIR_MISSING",
  "WORKSPACE_REGISTRY_DUPLICATE_ID",
  "WORKSPACE_REGISTRY_UNKNOWN",
] as const;

let telemetrySink: ((event: WorkspaceRegistryTelemetryEvent) => void) | undefined;

/** Host wiring — forward registry failures to observability (logger, metrics, tracing). */
export function setWorkspaceRegistryTelemetrySink(
  sink: ((event: WorkspaceRegistryTelemetryEvent) => void) | undefined,
): void {
  telemetrySink = sink;
}

/** @internal test-only */
export function resetWorkspaceRegistryTelemetryForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    return;
  }
  telemetrySink = undefined;
}

export function emitWorkspaceRegistryTelemetry(event: WorkspaceRegistryTelemetryEvent): void {
  telemetrySink?.(event);
}

function extractKnownCode(message: string): WorkspaceRegistryFailureCode | undefined {
  for (const code of KNOWN_CODES) {
    if (message.startsWith(`${code}:`)) {
      return code;
    }
  }
  return undefined;
}

/** Maps thrown registry errors to structured telemetry events (PII-free). */
export function workspaceRegistryErrorToTelemetry(
  error: unknown,
  context?: string,
): WorkspaceRegistryTelemetryEvent {
  if (error instanceof Error) {
    const code = extractKnownCode(error.message) ?? "WORKSPACE_REGISTRY_LOAD_FAILED";
    const colon = error.message.indexOf(":");
    const detail = colon >= 0 ? error.message.slice(colon + 1) : error.message;
    return {
      code,
      message: error.message,
      context: context ?? (detail.length > 0 ? detail : undefined),
    };
  }

  return {
    code: "WORKSPACE_REGISTRY_LOAD_FAILED",
    message: String(error),
    context,
  };
}

export function reportWorkspaceRegistryFailure(error: unknown, context?: string): void {
  emitWorkspaceRegistryTelemetry(workspaceRegistryErrorToTelemetry(error, context));
}
