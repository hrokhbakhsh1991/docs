import { reportWorkspacePluginBootstrapStatus } from "./workspace-plugin-bootstrap-telemetry";
import {
  WORKSPACE_PLUGIN_REGISTER_IDS,
  WORKSPACE_PLUGIN_REGISTER_REVISION,
  invokeWorkspaceIntakeRegister,
  invokeWorkspacePluginRegister,
} from "./workspace-plugin-register-manifest.generated";

type WorkspacePluginRegisterInvoker = (pluginId: string) => Promise<void>;

let testInvokeWorkspacePluginRegister: WorkspacePluginRegisterInvoker | undefined;
let testInvokeWorkspaceIntakeRegister: WorkspacePluginRegisterInvoker | undefined;

/** @internal test-only — inject per-plugin load failures for chaos/isolation specs */
export function __test_setWorkspacePluginRegisterInvokers(
  invokers:
    | Readonly<{
        readonly full?: WorkspacePluginRegisterInvoker;
        readonly intake?: WorkspacePluginRegisterInvoker;
      }>
    | undefined,
): void {
  if (process.env.NODE_ENV !== "test") {
    return;
  }
  testInvokeWorkspacePluginRegister = invokers?.full;
  testInvokeWorkspaceIntakeRegister = invokers?.intake;
}

export type WorkspacePluginBootstrapState =
  | { readonly status: "ready"; readonly pluginId: string }
  | { readonly status: "failed"; readonly pluginId: string; readonly error: string }
  | { readonly status: "pending"; readonly pluginId: string };

let activeRevision: string | null = null;
const statusByPlugin = new Map<string, WorkspacePluginBootstrapState>();
const inflight = new Map<string, Promise<WorkspacePluginBootstrapState>>();

function formatBootstrapError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ensureRevision(): void {
  if (activeRevision === WORKSPACE_PLUGIN_REGISTER_REVISION) {
    return;
  }
  activeRevision = WORKSPACE_PLUGIN_REGISTER_REVISION;
  statusByPlugin.clear();
  inflight.clear();
}

/** @internal — tests and dev tooling */
export function resetWorkspacePluginBootstrapStateForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    return;
  }
  activeRevision = null;
  statusByPlugin.clear();
  inflight.clear();
  testInvokeWorkspacePluginRegister = undefined;
  testInvokeWorkspaceIntakeRegister = undefined;
}

export function getWorkspacePluginBootstrapStatus(
  pluginId: string,
): WorkspacePluginBootstrapState | undefined {
  return statusByPlugin.get(pluginId);
}

export function listWorkspacePluginBootstrapStatuses(): readonly WorkspacePluginBootstrapState[] {
  return [...statusByPlugin.values()];
}

/** Plugin ids whose most recent full registration completed with `ready`. */
export function listHealthyWorkspacePluginIds(): readonly string[] {
  return WORKSPACE_PLUGIN_REGISTER_IDS.filter(
    (pluginId) => statusByPlugin.get(pluginId)?.status === "ready",
  );
}

function emitTerminalBootstrapStatus(state: WorkspacePluginBootstrapState): void {
  if (state.status === "pending") {
    return;
  }
  reportWorkspacePluginBootstrapStatus(state);
}

/**
 * Per-plugin lazy registration — never throws; records `ready` or `failed` status.
 * Preserves catalogIntake skip semantics inside generated per-plugin modules.
 */
export async function registerWorkspacePluginSafe(
  pluginId: string,
): Promise<WorkspacePluginBootstrapState> {
  ensureRevision();

  const cached = statusByPlugin.get(pluginId);
  if (cached?.status === "ready" || cached?.status === "failed") {
    return cached;
  }

  const inflightHit = inflight.get(pluginId);
  if (inflightHit !== undefined) {
    return inflightHit;
  }

  const promise = (async (): Promise<WorkspacePluginBootstrapState> => {
    statusByPlugin.set(pluginId, { status: "pending", pluginId });
    try {
      await (testInvokeWorkspacePluginRegister ?? invokeWorkspacePluginRegister)(pluginId);
      const ready: WorkspacePluginBootstrapState = { status: "ready", pluginId };
      statusByPlugin.set(pluginId, ready);
      emitTerminalBootstrapStatus(ready);
      return ready;
    } catch (error: unknown) {
      const failed: WorkspacePluginBootstrapState = {
        status: "failed",
        pluginId,
        error: formatBootstrapError(error),
      };
      statusByPlugin.set(pluginId, failed);
      emitTerminalBootstrapStatus(failed);
      return failed;
    } finally {
      inflight.delete(pluginId);
    }
  })();

  inflight.set(pluginId, promise);
  return promise;
}

/** Intake dispatch uses the plugin-entry registrar only (no registration-flow UI graph). */
export async function registerWorkspaceIntakeSafe(
  pluginId: string,
): Promise<WorkspacePluginBootstrapState> {
  ensureRevision();

  const cached = statusByPlugin.get(`${pluginId}:intake`);
  if (cached?.status === "ready" || cached?.status === "failed") {
    return cached;
  }

  const inflightKey = `${pluginId}:intake`;
  const inflightHit = inflight.get(inflightKey);
  if (inflightHit !== undefined) {
    return inflightHit;
  }

  const promise = (async (): Promise<WorkspacePluginBootstrapState> => {
    statusByPlugin.set(inflightKey, { status: "pending", pluginId });
    try {
      await (testInvokeWorkspaceIntakeRegister ?? invokeWorkspaceIntakeRegister)(pluginId);
      const ready: WorkspacePluginBootstrapState = { status: "ready", pluginId };
      statusByPlugin.set(inflightKey, ready);
      emitTerminalBootstrapStatus(ready);
      return ready;
    } catch (error: unknown) {
      const failed: WorkspacePluginBootstrapState = {
        status: "failed",
        pluginId,
        error: formatBootstrapError(error),
      };
      statusByPlugin.set(inflightKey, failed);
      emitTerminalBootstrapStatus(failed);
      return failed;
    } finally {
      inflight.delete(inflightKey);
    }
  })();

  inflight.set(inflightKey, promise);
  return promise;
}

/** Warm all trunk plugins — failures are isolated per plugin. */
export async function registerAllWorkspacePluginsSafe(): Promise<
  readonly WorkspacePluginBootstrapState[]
> {
  ensureRevision();
  return Promise.all(WORKSPACE_PLUGIN_REGISTER_IDS.map((id) => registerWorkspacePluginSafe(id)));
}
