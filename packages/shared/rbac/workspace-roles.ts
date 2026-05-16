export enum WorkspaceRole {
  Owner = "owner",
  Leader = "leader",
  Admin = "admin",
  Member = "member",
  Viewer = "viewer"
}

/** Higher number = higher privilege. */
export const ROLE_RANK: Readonly<Record<WorkspaceRole, number>> = Object.freeze({
  [WorkspaceRole.Viewer]: 1,
  [WorkspaceRole.Member]: 2,
  [WorkspaceRole.Admin]: 3,
  [WorkspaceRole.Leader]: 4,
  [WorkspaceRole.Owner]: 5
});

/**
 * Parses persisted JWT / DB / invite role strings into {@link WorkspaceRole}.
 * Unknown values return `undefined` (no loose string casting).
 */
export function tryParseWorkspaceRole(raw: string | undefined | null): WorkspaceRole | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const key = raw.trim().toLowerCase();
  if (key === "") {
    return undefined;
  }
  if (key === "operator") {
    return WorkspaceRole.Member;
  }
  for (const value of Object.values(WorkspaceRole)) {
    if (value === key) {
      return value;
    }
  }
  return undefined;
}
