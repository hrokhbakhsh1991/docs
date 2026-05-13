/** CASL action literals aligned with `@repo/shared-rbac` / API guards. */
export const AbilityAction = {
  Manage: "manage",
  Create: "create",
  Read: "read",
  Update: "update",
  Delete: "delete"
} as const;

export type AbilityAction = (typeof AbilityAction)[keyof typeof AbilityAction];
