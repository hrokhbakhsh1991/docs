import { sealWorkspaceTheme, type SealedWorkspaceTheme } from "./theme-safety-seal";
import type { WorkspaceThemeContract } from "./workspace-theme.contract";

/**
 * Deep-snapshots a validated workspace theme so DOM builders cannot observe
 * post-validation mutations on the caller's object (TOCTOU).
 */
export function snapshotWorkspaceTheme(theme: WorkspaceThemeContract): SealedWorkspaceTheme {
  const cssVariables = Object.freeze(
    Object.fromEntries(Object.entries(theme.cssVariables).map(([key, value]) => [key, value])),
  );

  const snapshot: WorkspaceThemeContract = Object.freeze({
    id: theme.id,
    version: theme.version,
    cssVariables,
    ...(theme.optionalStylesheet !== undefined
      ? { optionalStylesheet: theme.optionalStylesheet }
      : {}),
  });

  return sealWorkspaceTheme(snapshot);
}
