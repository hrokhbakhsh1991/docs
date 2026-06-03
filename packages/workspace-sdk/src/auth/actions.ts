/** CASL actions — aligned with platform ability vocabulary (see legacy ability-actions for port map). */
export const AbilityAction = {
  Manage: "manage",
  Create: "create",
  Read: "read",
  Update: "update",
  Delete: "delete",
  Access: "access",
  Install: "install",
} as const;

export type AbilityAction = (typeof AbilityAction)[keyof typeof AbilityAction];
