/** Opaque workspace-scoped auth surface id (product packages define concrete string unions). */
export type WorkspaceAuthSurface = string;

export type WorkspaceOwnerMutationPolicy = {
  readonly requiredWorkspaceType: string;
  readonly allowedSurfaces: ReadonlySet<WorkspaceAuthSurface>;
};

export function isWorkspaceAuthSurfaceAllowed(
  surface: WorkspaceAuthSurface,
  allowlist: ReadonlySet<WorkspaceAuthSurface>
): boolean {
  return allowlist.has(surface);
}

/** Type-narrowing allowlist check for product owner surface unions (DG-1.5). */
export function isWorkspaceAuthSurfaceInAllowlist<T extends string>(
  surface: WorkspaceAuthSurface,
  allowlist: ReadonlySet<T>,
): surface is T {
  return allowlist.has(surface as T);
}
