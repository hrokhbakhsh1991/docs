import {
  assertWorkspacePlugin,
  isWorkspaceSdkValidationError,
  snapshotWorkspaceTheme,
  workspaceSdkValidationErrorCode,
  type SealedWorkspaceTheme,
  type WorkspacePlugin,
  type WorkspaceThemeContract,
} from "@app-tour/workspace-sdk";

/** Plugin snapshot after theme ingress — `theme` is sealed when present. */
export type GuardedWorkspacePlugin = Omit<WorkspacePlugin, "theme"> & {
  readonly theme?: SealedWorkspaceTheme;
};

export class ThemeIngressGuardError extends Error {
  readonly causeCode?: string;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ThemeIngressGuardError";
    if (isWorkspaceSdkValidationError(cause)) {
      this.causeCode = workspaceSdkValidationErrorCode(cause);
    }
  }
}

/**
 * Validates a workspace theme update using the same rules as {@link assertWorkspacePlugin}.
 * Rejects invalid CSS variable keys/values before they reach the DOM.
 */
export function validateWorkspaceThemeIngress(
  plugin: WorkspacePlugin,
  theme: WorkspaceThemeContract | undefined,
): GuardedWorkspacePlugin {
  const candidate: WorkspacePlugin = {
    ...plugin,
    theme,
  };

  try {
    assertWorkspacePlugin(candidate);
  } catch (error) {
    throw new ThemeIngressGuardError(
      "Workspace theme failed ingress validation",
      error,
    );
  }

  if (candidate.theme === undefined) {
    return { ...plugin, theme: undefined };
  }

  return {
    ...plugin,
    theme: snapshotWorkspaceTheme(candidate.theme),
  };
}

/**
 * Applies a theme patch to a plugin after ingress validation.
 */
export function applyWorkspaceThemeUpdate(
  plugin: WorkspacePlugin,
  theme: WorkspaceThemeContract | undefined,
): GuardedWorkspacePlugin {
  return validateWorkspaceThemeIngress(plugin, theme);
}
