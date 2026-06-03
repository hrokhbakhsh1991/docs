/**
 * Workspace-level visual brand contract (CSS custom properties on plugin subtree).
 * Platform core does not read theme — web providers apply {@link WorkspaceThemeContract}.
 */
export interface WorkspaceThemeContract {
  readonly id: string;
  /** Monotonic — bump on breaking CSS variable renames. */
  readonly version: number;
  /**
   * CSS custom properties applied on workspace subtree root.
   * Keys MUST normalize to `--ws-*` (see workspace-plugin validation).
   */
  readonly cssVariables: Readonly<Record<string, string>>;
  /**
   * Optional first-party stylesheet path relative to workspace package root.
   * Loaded by web bootstrap — not evaluated in Node.
   */
  readonly optionalStylesheet?: string;
}
