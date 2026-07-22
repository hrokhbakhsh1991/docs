import type { WorkspaceHttpHandlerFn, WorkspaceRouteHandlers } from "../http/workspace-route-registrar";
import type { WorkspaceHttpHandlerKey } from "../http/workspace-http-routes.generated";
import {
  ensureWorkspaceHttpHandler,
  loadWorkspaceHttpPackageHandlers,
  resetWorkspaceHttpHandlerPackageCache,
} from "../http/workspace-http-handler-loaders.generated";

export function resetLazyWorkspaceFinanceHandlersForTests(): void {
  resetWorkspaceHttpHandlerPackageCache();
}

/** Wave G.b — resolve one workspace HTTP handler (per-package cache). */
export async function resolveWorkspaceHttpHandler(
  key: WorkspaceHttpHandlerKey
): Promise<WorkspaceHttpHandlerFn> {
  return ensureWorkspaceHttpHandler(key);
}

/**
 * Compat — loads all packages. Prefer {@link resolveWorkspaceHttpHandler} on the hot path.
 */
export async function buildWorkspaceRouteHandlers(): Promise<WorkspaceRouteHandlers> {
  return loadWorkspaceHttpPackageHandlers() as Promise<WorkspaceRouteHandlers>;
}
