import type { WorkspaceRouteHandlers } from "../http/workspace-route-registrar";
import { loadWorkspaceHttpPackageHandlers } from "../http/workspace-http-handler-loaders.generated";
import type { LazyRouteHandlers } from "./lazy-route-handlers";

let workspacePackageHandlersPromise: Promise<
  Awaited<ReturnType<typeof loadWorkspaceHttpPackageHandlers>>
> | null = null;

export function resetLazyWorkspaceFinanceHandlersForTests(): void {
  workspacePackageHandlersPromise = null;
}

function loadWorkspacePackageHandlers() {
  if (workspacePackageHandlersPromise === null) {
    workspacePackageHandlersPromise = loadWorkspaceHttpPackageHandlers();
  }
  return workspacePackageHandlersPromise;
}

export async function buildWorkspaceRouteHandlers(
  urbanHandlers: LazyRouteHandlers
): Promise<WorkspaceRouteHandlers> {
  const packageHandlers = await loadWorkspacePackageHandlers();
  return {
    handleGetUrbanSettings: urbanHandlers.handleGetUrbanSettings,
    handlePatchUrbanSettings: urbanHandlers.handlePatchUrbanSettings,
    handleGetUrbanCatalog: urbanHandlers.handleGetUrbanCatalog,
    handleGetUrbanCatalogTour: urbanHandlers.handleGetUrbanCatalogTour,
    handlePostUrbanRegistration: urbanHandlers.handlePostUrbanRegistration,
    ...packageHandlers,
  };
}
