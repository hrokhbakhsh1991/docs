import type { WorkspaceRouteHandlers } from "../http/workspace-route-registrar";
import { loadWorkspaceHttpPackageHandlers } from "../http/workspace-http-handler-loaders.generated";

let workspacePackageHandlersPromise: Promise<WorkspaceRouteHandlers> | null = null;

export function resetLazyWorkspaceFinanceHandlersForTests(): void {
  workspacePackageHandlersPromise = null;
}

export async function buildWorkspaceRouteHandlers(): Promise<WorkspaceRouteHandlers> {
  if (workspacePackageHandlersPromise === null) {
    workspacePackageHandlersPromise = loadWorkspaceHttpPackageHandlers();
  }
  return workspacePackageHandlersPromise;
}
