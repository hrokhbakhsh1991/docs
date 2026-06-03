"use client";

import { useMemo } from "react";

import type { WorkspacePlugin, WorkspaceThemeContract } from "@app-tour/workspace-sdk";

import { validateWorkspaceThemeIngress, type GuardedWorkspacePlugin } from "./theme-ingress-guard";

/**
 * Intercepts `workspacePlugin.theme` updates and validates via {@link assertWorkspacePlugin} rules.
 * Returns a plugin snapshot safe to pass to {@link WorkspaceThemeProvider}.
 */
export function useThemeIngressGuard(
  plugin: WorkspacePlugin,
  theme: WorkspaceThemeContract | undefined,
): GuardedWorkspacePlugin {
  return useMemo(() => validateWorkspaceThemeIngress(plugin, theme), [plugin, theme]);
}
