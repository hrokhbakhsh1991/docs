import type { Prisma } from "@prisma/client";

export const PLATFORM_AUDIT_ACTION_TENANT_CREATED = "TENANT_CREATED";
export const PLATFORM_AUDIT_ACTION_TENANT_UPDATED = "TENANT_UPDATED";
export const PLATFORM_AUDIT_ACTION_TENANT_DELETED = "TENANT_DELETED";
export const PLATFORM_AUDIT_ACTION_IMPERSONATE_START = "IMPERSONATE_START";
export const PLATFORM_AUDIT_ACTION_IMPERSONATE_END = "IMPERSONATE_END";
export const PLATFORM_AUDIT_ACTION_SUBSCRIPTION_MARKED_PAID = "SUBSCRIPTION_MARKED_PAID";
export const PLATFORM_AUDIT_ACTION_SUBSCRIPTION_PLAN_CHANGED = "SUBSCRIPTION_PLAN_CHANGED";
export const PLATFORM_AUDIT_ACTION_SUBSCRIPTION_PAST_DUE = "SUBSCRIPTION_PAST_DUE";
export const PLATFORM_AUDIT_ACTION_TENANT_SUSPENDED_BILLING = "TENANT_SUSPENDED_BILLING";
export const PLATFORM_AUDIT_ACTION_DOMAIN_VERIFIED = "DOMAIN_VERIFIED";
export const PLATFORM_AUDIT_ACTION_DOMAIN_SSL_PROVISIONED = "DOMAIN_SSL_PROVISIONED";
export const PLATFORM_AUDIT_ACTION_DOMAIN_SSL_FAILED = "DOMAIN_SSL_FAILED";
export const PLATFORM_AUDIT_ACTION_DOMAIN_SSL_EXPIRING = "DOMAIN_SSL_EXPIRING";
export const PLATFORM_AUDIT_ACTION_TENANT_OFFBOARDING_STARTED = "TENANT_OFFBOARDING_STARTED";
export const PLATFORM_AUDIT_ACTION_TENANT_OFFBOARDING_CANCELED = "TENANT_OFFBOARDING_CANCELED";
export const PLATFORM_AUDIT_ACTION_TENANT_EXPORT_REQUESTED = "TENANT_EXPORT_REQUESTED";
export const PLATFORM_AUDIT_ACTION_TENANT_DEFINITION_ASSIGNED = "TENANT_DEFINITION_ASSIGNED";
export const PLATFORM_AUDIT_ACTION_TENANT_DEFINITION_CLEARED = "TENANT_DEFINITION_CLEARED";
export const PLATFORM_AUDIT_ACTION_WORKSPACE_DEFINITION_PUBLISHED = "WORKSPACE_DEFINITION_PUBLISHED";

export type AppendPlatformAuditEventInput = {
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly actorId?: string;
  readonly metadata?: Prisma.InputJsonValue;
  readonly createdAt?: Date;
};

/**
 * P1-N-055: Append platform-level audit event (no tenantId).
 * For platform operator actions like tenant provisioning.
 */
export async function appendPlatformAuditEvent(
  tx: Prisma.TransactionClient,
  input: AppendPlatformAuditEventInput
): Promise<void> {
  await tx.platformAuditEvent.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId ?? null,
      metadata: input.metadata ?? {},
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
}

// Made with Bob
