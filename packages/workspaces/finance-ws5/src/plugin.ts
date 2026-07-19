/**
 * Minimal plugin stub — finance drop-in onboarding proof (workspaceFinance.supported).
 */
import {
  createStarterWorkspacePlugin,
  workspaceThemePresets,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);

const financeWs5WorkspacePlugin = Object.freeze({
  ...base,
  id: "finance-ws5",
  supportedWorkspaceTypes: Object.freeze(["finance-ws5"] as const),
}) as WorkspacePlugin;

export function getFinanceWs5WorkspacePlugin(): WorkspacePlugin {
  return financeWs5WorkspacePlugin;
}
