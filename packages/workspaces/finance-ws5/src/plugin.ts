/**
 * Minimal plugin stub — finance drop-in onboarding proof (workspaceFinance.supported).
 */
import {
  createStarterWorkspacePlugin,
  workspaceThemePresets,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

import {
  DEFAULT_FINANCE_OPS_MANIFEST,
  resolveFinanceOpsManifestFromTheme,
} from "./finance/finance-ops-manifest";

const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);

const financeWs5WorkspacePlugin = Object.freeze({
  ...base,
  id: "finance-ws5",
  supportedWorkspaceTypes: Object.freeze(["finance-ws5"] as const),
  capabilities: Object.freeze({
    financeNav: Object.freeze({ supported: true as const }),
    financeOps: Object.freeze({
      resolveManifest: (theme: unknown = null) =>
        theme === null || theme === undefined
          ? DEFAULT_FINANCE_OPS_MANIFEST
          : resolveFinanceOpsManifestFromTheme(theme),
    }),
  }),
}) as WorkspacePlugin;

export function getFinanceWs5WorkspacePlugin(): WorkspacePlugin {
  return financeWs5WorkspacePlugin;
}

/** Canonical host-contract getter (manifest plugin/web.export; Phase 4p). */
export function getWorkspacePlugin(): WorkspacePlugin {
  return getFinanceWs5WorkspacePlugin();
}
