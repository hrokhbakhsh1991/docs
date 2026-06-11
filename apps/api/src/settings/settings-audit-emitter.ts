import { randomUUID } from "node:crypto";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getSettingsAuditRepository } from "./create-settings-audit-repository";

export type SettingsAuditMutationInput = {
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly summary: string;
};

export async function emitSettingsAuditEvent(
  auth: TenantAuthContext,
  input: SettingsAuditMutationInput
): Promise<void> {
  const repo = getSettingsAuditRepository();
  await repo.append({
    id: randomUUID(),
    tenantId: auth.tenantId,
    occurredAt: new Date().toISOString(),
    actorUserId: auth.userId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    summary: input.summary,
  });
}

export async function emitSettingsResourceAudit(
  auth: TenantAuthContext,
  operation: "create" | "patch" | "delete",
  moduleId: string,
  resourceId: string,
  summary: string,
  resourceType = moduleId
): Promise<void> {
  await emitSettingsAuditEvent(auth, {
    action: `settings.${moduleId}.${operation}`,
    resourceType,
    resourceId,
    summary,
  });
}

export async function emitSettingsConfigAudit(
  auth: TenantAuthContext,
  configKey: string,
  summary: string
): Promise<void> {
  await emitSettingsAuditEvent(auth, {
    action: "settings.config.put",
    resourceType: "tenant_config",
    resourceId: configKey,
    summary,
  });
}
