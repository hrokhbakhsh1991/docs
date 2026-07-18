/**
 * Minimal plugin stub — registryOnly finance fixture (not product-gated).
 * Excluded from API/web plugin registries via workspaceFinance.registryOnly.
 */
import {
  createStarterWorkspacePlugin,
  workspaceThemePresets,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);

const financeWs2WorkspacePlugin = Object.freeze({
  ...base,
  id: "finance-ws2",
  supportedWorkspaceTypes: Object.freeze(["finance-ws2"] as const),
}) as WorkspacePlugin;

export function getFinanceWs2WorkspacePlugin(): WorkspacePlugin {
  return financeWs2WorkspacePlugin;
}
