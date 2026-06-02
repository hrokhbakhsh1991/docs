/**
 * Pure utility for resolving the active WorkspaceSubnav tab from a pathname.
 * Kept dependency-free so it can be unit-tested without CSS/Next.js imports.
 */

export type WorkspaceSubnavTab = "registrations" | "waitlist" | "transport";

function workspaceBasePath(tourId: string): string {
  return `/tours/${encodeURIComponent(tourId)}/workspace`;
}

export function resolveWorkspaceSubnavTab(
  pathname: string,
  tourId: string,
): WorkspaceSubnavTab {
  const base = workspaceBasePath(tourId);
  if (pathname === `${base}/waitlist` || pathname.startsWith(`${base}/waitlist/`)) {
    return "waitlist";
  }
  if (pathname === `${base}/transport` || pathname.startsWith(`${base}/transport/`)) {
    return "transport";
  }
  return "registrations";
}
