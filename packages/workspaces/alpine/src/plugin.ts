import {
  createStarterWorkspacePlugin,
  workspaceThemePresets,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

import {
  DEFAULT_ALPINE_FINANCE_OPS_MANIFEST,
  resolveAlpineFinanceOpsManifestFromTheme,
} from "./finance/finance-ops-manifest";

const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);

const alpineWorkspacePlugin = Object.freeze({
  ...base,
  id: "alpine",
  supportedWorkspaceTypes: Object.freeze(["alpine"] as const),
  capabilities: Object.freeze({
    operatorShellNav: Object.freeze({
      links: Object.freeze([{ href: "/alpine-field-notes", labelKey: "alpineFieldNotes" }] as const),
    }),
    memberPortalRenderers: Object.freeze({
      renderers: Object.freeze({
        "alpine-notes": (props: { readonly moduleId: string; readonly routePath: string }) =>
          Object.freeze({ kind: "alpine-member-renderer", moduleId: props.moduleId, routePath: props.routePath }),
      }),
    }),
    financeNav: Object.freeze({ supported: true as const }),
    financeOps: Object.freeze({
      resolveManifest: (theme: unknown = null) =>
        theme === null || theme === undefined
          ? DEFAULT_ALPINE_FINANCE_OPS_MANIFEST
          : resolveAlpineFinanceOpsManifestFromTheme(theme),
    }),
  }),
}) as WorkspacePlugin;

export function getAlpineWorkspacePlugin(): WorkspacePlugin {
  return alpineWorkspacePlugin;
}

export function getWorkspacePlugin(): WorkspacePlugin {
  return getAlpineWorkspacePlugin();
}
