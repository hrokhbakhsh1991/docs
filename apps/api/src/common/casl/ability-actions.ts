/** CASL action literals aligned with {@link defineAbilityFor} / `MongoAbility`. */
export const AbilityAction = {
  Manage: "manage",
  Create: "create",
  Read: "read",
  Update: "update",
  Delete: "delete",
  /** Tour lifecycle transition to OPEN (`tour.publish` capability). */
  Publish: "publish"
} as const;

export type AbilityAction = (typeof AbilityAction)[keyof typeof AbilityAction];
