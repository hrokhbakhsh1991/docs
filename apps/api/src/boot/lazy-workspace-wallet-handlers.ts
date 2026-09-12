import type { WorkspaceHttpHandlerFn, WorkspaceRouteHandlers } from "../http/workspace-route-registrar";
import type { WorkspaceHttpHandlerKey } from "../http/workspace-http-routes.generated";
import {
  ensureWorkspaceHttpHandler,
  loadWorkspaceHttpPackageHandlers,
  resetWorkspaceHttpHandlerPackageCache,
} from "../http/workspace-http-handler-loaders.generated";

export function resetLazyWorkspaceWalletHandlersForTests(): void {
  resetWorkspaceHttpHandlerPackageCache();
}

export async function resolveWorkspaceWalletHttpHandler(
  key: WorkspaceHttpHandlerKey,
): Promise<WorkspaceHttpHandlerFn> {
  return ensureWorkspaceHttpHandler(key);
}

export async function buildWorkspaceWalletRouteHandlers(): Promise<WorkspaceRouteHandlers> {
  return loadWorkspaceHttpPackageHandlers() as Promise<WorkspaceRouteHandlers>;
}
