export type WorkspaceTourPatchBody = {
  readonly roots?: readonly string[];
  readonly data?: Record<string, unknown>;
};

export type WorkspaceTourPatchTouchesPublishFieldsOptions = {
  readonly protectedPaths: readonly string[];
  readonly dataTouchesPublishFields: (data: Record<string, unknown>) => boolean;
};

function pathSetIncludesProtectedPath(
  paths: readonly string[],
  protectedPaths: readonly string[],
): boolean {
  for (const path of paths) {
    if (protectedPaths.includes(path)) {
      return true;
    }
  }
  return false;
}

/**
 * Shared owner-gate probe for tour PATCH bodies (DG-1.4).
 * Product workspaces supply protected root paths + nested data predicate.
 */
export function workspaceTourPatchTouchesPublishFields(
  body: WorkspaceTourPatchBody,
  options: WorkspaceTourPatchTouchesPublishFieldsOptions,
): boolean {
  if (
    body.roots !== undefined &&
    pathSetIncludesProtectedPath(body.roots, options.protectedPaths)
  ) {
    return true;
  }
  if (body.data !== undefined && options.dataTouchesPublishFields(body.data)) {
    return true;
  }
  return false;
}
