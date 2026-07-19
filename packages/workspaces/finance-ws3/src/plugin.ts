/**
 * Minimal plugin stub — finance drop-in onboarding proof (workspaceFinance.supported).
 */
import {
  createStarterWorkspacePlugin,
  workspaceThemePresets,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);

const financeWs3WorkspacePlugin = Object.freeze({
  ...base,
  id: "finance-ws3",
  supportedWorkspaceTypes: Object.freeze(["finance-ws3"] as const),
}) as WorkspacePlugin;

export function getFinanceWs3WorkspacePlugin(): WorkspacePlugin {
  return financeWs3WorkspacePlugin;
}
