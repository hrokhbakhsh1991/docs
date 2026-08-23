import {
  createStarterWorkspacePlugin,
  type WorkspacePlugin,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";

export const POLICY_CERT_WORKSPACE_PLUGIN_ID = "policy-cert" as const;
export const POLICY_CERT_WORKSPACE_TYPE = "policy-cert" as const;

export function getWorkspacePlugin(): WorkspacePlugin {
  const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
  return Object.freeze({
    ...base,
    id: POLICY_CERT_WORKSPACE_PLUGIN_ID,
    supportedWorkspaceTypes: [POLICY_CERT_WORKSPACE_TYPE],
  });
}
