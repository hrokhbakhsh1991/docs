/**
 * Minimal plugin stub — finance drop-in onboarding proof (workspaceFinance.supported).
 */
import {
  createStarterWorkspacePlugin,
  workspaceThemePresets,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);

const financeWs4WorkspacePlugin = Object.freeze({
  ...base,
  id: "finance-ws4",
  supportedWorkspaceTypes: Object.freeze(["finance-ws4"] as const),
}) as WorkspacePlugin;

export function getFinanceWs4WorkspacePlugin(): WorkspacePlugin {
  return financeWs4WorkspacePlugin;
}
