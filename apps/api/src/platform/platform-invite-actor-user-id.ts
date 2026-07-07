/**
 * Sentinel `operator_pending_invites.invited_by_user_id` for platform-provisioned clubs.
 * Platform audit rows still store the ops phone in `platform_audit_events.actor_id`.
 */
export const PLATFORM_PROVISION_INVITE_ACTOR_USER_ID =
  "00000000-0000-4000-8000-000000000201" as const;
