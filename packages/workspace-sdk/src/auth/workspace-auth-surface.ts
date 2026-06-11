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
