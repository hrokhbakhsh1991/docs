/** Canonical tenant audit stream actions (stable identifiers for SIEM / export filters). */
export const TenantAuditAction = {
  AUTH_LOGIN_WEB: "auth.login.web",
  AUTH_LOGIN_TELEGRAM: "auth.login.telegram",
  AUTH_WORKSPACE_SWITCH: "auth.workspace.switch",
  USER_INVITED: "user.invited",
  USER_INVITE_RESENT: "user.invite.resent",
  USER_JOINED: "user.joined",
  USER_SUSPENDED: "user.suspended",
  USER_REACTIVATED: "user.reactivated",
  USER_REMOVED: "user.removed",
  MEMBERSHIP_ROLE_CHANGED: "membership.role.changed",
  MEMBERSHIP_CAPABILITIES_CHANGED: "membership.capabilities.changed",
  MEMBERSHIP_REWARDS_CHANGED: "membership.rewards.changed",
  MEMBERSHIP_REMOVED: "membership.removed",
  WORKSPACE_OWNERSHIP_TRANSFERRED: "workspace.ownership.transferred",
  WORKSPACE_MODULES_CHANGED: "workspace.modules.changed",
  WORKSPACE_INVITE_ACCEPTED: "workspace.invite.accepted",
  DATA_EXPORT_AUDIT: "data.export.audit_trail",

  PROFILE_EMAIL_VERIFICATION_STARTED: "profile.email.verification_started",
  PROFILE_EMAIL_VERIFIED: "profile.email.verified",
  PROFILE_SELF_PII_FIELDS_UPDATED: "profile.self.pii_updated",
  PROFILE_PHONE_UPDATED_SELF: "profile.phone.updated_self"
} as const;

export type TenantAuditActionType =
  (typeof TenantAuditAction)[keyof typeof TenantAuditAction];
