/**
 * Minimal plugin stub — finance-ws6 drop-in onboarding proof.
 */
import {
  createStarterWorkspacePlugin,
  workspaceThemePresets,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);

const financeWs6WorkspacePlugin = Object.freeze({
  ...base,
  id: "finance-ws6",
  supportedWorkspaceTypes: Object.freeze(["finance-ws6"] as const),
}) as WorkspacePlugin;

export function getFinanceWs6WorkspacePlugin(): WorkspacePlugin {
  return financeWs6WorkspacePlugin;
}
