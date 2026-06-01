/**
 * Stable idempotency scope for tour clone: same key + source + workspace replays the prior clone.
 */
export function buildTourCloneIdempotencyScope(input: {
  sourceTourId: string;
  workspaceId: string;
}): {
  endpoint: string;
  path: string;
  body: { workspaceId: string };
} {
  const sourceTourId = input.sourceTourId.trim();
  const workspaceId = input.workspaceId.trim();
  const path = `/api/v2/tours/clone/${sourceTourId}`;
  return {
    endpoint: path,
    path,
    body: { workspaceId },
  };
}
