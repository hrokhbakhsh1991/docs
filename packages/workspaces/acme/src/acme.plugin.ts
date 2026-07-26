import {
  createStarterWorkspacePlugin,
  type WorkspacePlugin,
  workspaceThemePresets,
} from "@app-cloud/workspace-sdk";

export const ACME_WORKSPACE_PLUGIN_ID = "acme" as const;
export const ACME_WORKSPACE_TYPE = "acme" as const;

export function getWorkspacePlugin(): WorkspacePlugin {
  const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
  return Object.freeze({
    ...base,
    id: ACME_WORKSPACE_PLUGIN_ID,
    supportedWorkspaceTypes: [ACME_WORKSPACE_TYPE],
    capabilities: Object.freeze({
      hostProbe: Object.freeze({
        title: "Acme workspace",
        body: "Thin Shell host-probe capability stub",
      }),
    }),
  });
}

/** Branded alias — same singleton factory as {@link getWorkspacePlugin}. */
export function getAcmeWorkspacePlugin(): WorkspacePlugin {
  return getWorkspacePlugin();
}
