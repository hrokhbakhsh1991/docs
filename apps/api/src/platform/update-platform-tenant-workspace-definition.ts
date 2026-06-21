import type { PrismaClient } from "@prisma/client";

import { getPrismaAdmin } from "../db/prisma.ts";
import {
  appendPlatformAuditEvent,
  PLATFORM_AUDIT_ACTION_TENANT_DEFINITION_ASSIGNED,
  PLATFORM_AUDIT_ACTION_TENANT_DEFINITION_CLEARED,
} from "./platform-audit-logger.ts";
import {
  toPlatformTenantWorkspaceDefinitionDto,
  type PlatformTenantWorkspaceDefinitionDto,
} from "./platform-tenant-workspace-definition.dto.ts";
import { PlatformTenantRepository } from "./platform-tenant.repository.ts";
import { PlatformValidation } from "./platform.errors.ts";
import type { UpdatePlatformTenantWorkspaceDefinitionBody } from "./update-platform-tenant-workspace-definition.schema.ts";
import { WorkspaceDefinitionRepository } from "../workspace-metadata/workspace-definition.repository.ts";
import { invalidateValidationEngineCacheForTenant } from "../tours/canonical-validation-sync.ts";

export async function updatePlatformTenantWorkspaceDefinition(input: {
  readonly tenantId: string;
  readonly actorId: string;
  readonly patch: UpdatePlatformTenantWorkspaceDefinitionBody;
  readonly tenantRepository?: PlatformTenantRepository;
  readonly definitionRepository?: WorkspaceDefinitionRepository;
  readonly prisma?: Pick<PrismaClient, "$transaction" | "workspaceDefinition">;
}): Promise<PlatformTenantWorkspaceDefinitionDto | null> {
  const tenantRepository = input.tenantRepository ?? new PlatformTenantRepository();
  const definitionRepository = input.definitionRepository ?? new WorkspaceDefinitionRepository();
  const prisma = input.prisma ?? getPrismaAdmin();

  const existing = await tenantRepository.getById(input.tenantId);
  if (!existing) {
    return null;
  }

  if (input.patch.definitionId === null) {
    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: input.tenantId },
        data: {
          workspaceDefinitionId: null,
          workspaceDefinitionVersion: null,
        },
      });
      if (existing.workspaceDefinitionId) {
        await appendPlatformAuditEvent(tx, {
          action: PLATFORM_AUDIT_ACTION_TENANT_DEFINITION_CLEARED,
          entityType: "tenant",
          entityId: input.tenantId,
          actorId: input.actorId,
          metadata: {
            tenantId: input.tenantId,
            previousDefinitionId: existing.workspaceDefinitionId,
            previousDefinitionVersion: existing.workspaceDefinitionVersion,
          },
        });
      }
    });
    invalidateValidationEngineCacheForTenant(input.tenantId);
    return null;
  }

  const pinnedVersion =
    input.patch.definitionVersion === undefined ? null : input.patch.definitionVersion;
  const published = await definitionRepository.getPublishedVersion(
    input.patch.definitionId,
    pinnedVersion
  );
  if (!published) {
    throw new PlatformValidation(
      `workspace definition not found or not published: ${input.patch.definitionId}`
    );
  }

  const definition = await prisma.workspaceDefinition.findUnique({
    where: { id: input.patch.definitionId },
    select: { displayName: true },
  });
  if (!definition) {
    throw new PlatformValidation(`workspace definition not found: ${input.patch.definitionId}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: input.tenantId },
      data: {
        workspaceDefinitionId: input.patch.definitionId,
        workspaceDefinitionVersion: pinnedVersion,
      },
    });
    await appendPlatformAuditEvent(tx, {
      action: PLATFORM_AUDIT_ACTION_TENANT_DEFINITION_ASSIGNED,
      entityType: "tenant",
      entityId: input.tenantId,
      actorId: input.actorId,
      metadata: {
        tenantId: input.tenantId,
        definitionId: input.patch.definitionId,
        definitionVersion: pinnedVersion,
        previousDefinitionId: existing.workspaceDefinitionId,
        previousDefinitionVersion: existing.workspaceDefinitionVersion,
      },
    });
  });

  invalidateValidationEngineCacheForTenant(input.tenantId);

  return toPlatformTenantWorkspaceDefinitionDto({
    definitionId: input.patch.definitionId,
    definitionVersion: pinnedVersion,
    displayName: definition.displayName,
  });
}
