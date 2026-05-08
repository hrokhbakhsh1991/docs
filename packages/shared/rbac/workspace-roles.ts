export type WorkspaceRole = "viewer" | "member" | "admin" | "leader" | "owner";

/** Higher number = higher privilege. Includes structural `leader` for future use. */
export const ROLE_RANK: Readonly<Record<WorkspaceRole, number>> = Object.freeze({
  viewer: 1,
  member: 2,
  admin: 3,
  leader: 4,
  owner: 5,
});
