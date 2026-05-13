/**
 * JWT / membership role strings used by RolesGuard.
 * `PARTICIPANT` is the product term for tenant `member` in participant-only routes.
 * Leader-style workspace access uses persisted role `owner` (or `admin` where allowed).
 */
export enum Role {
  PARTICIPANT = "member",
  OWNER = "owner",
  ADMIN = "admin",
  LEADER = "leader",
  MEMBER = "member"
}
