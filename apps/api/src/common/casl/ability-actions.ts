/** CASL action literals aligned with {@link defineAbilityFor} / `MongoAbility`. */
export const AbilityAction = {
  Manage: "manage",
  Create: "create",
  Read: "read",
  Update: "update",
  Delete: "delete"
} as const;

export type AbilityAction = (typeof AbilityAction)[keyof typeof AbilityAction];
