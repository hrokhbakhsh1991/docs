/**
 * Wallet-ws1 plugin — contract certification fixture only (no wallet product surfaces).
 */
import {
  createStarterWorkspacePlugin,
  workspaceThemePresets,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);

const walletWs1WorkspacePlugin = Object.freeze({
  ...base,
  id: "wallet-ws1",
  supportedWorkspaceTypes: Object.freeze(["wallet-ws1"] as const),
}) as WorkspacePlugin;

export function getWalletWs1WorkspacePlugin(): WorkspacePlugin {
  return walletWs1WorkspacePlugin;
}
