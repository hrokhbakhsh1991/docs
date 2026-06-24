import type { PrismaClient } from "@prisma/client";

import {
  validateWorkspaceDefinitionPayload,
  type WorkspaceDefinitionPayload,
} from "@app-tour/workspace-sdk/metadata";
import { computeWorkspaceDefinitionPayloadChecksum } from "@app-tour/workspace-sdk/metadata/checksum";

import { getPrismaAdmin } from "../db/prisma.ts";
import { mergeCommerceIntoWorkspaceDefinitionPayload } from "../workspace-metadata/persist-commerce-on-publish.ts";
import { assertWorkspaceDefinitionRendererAllowlist } from "./assert-workspace-definition-renderer-allowlist.ts";
import {
  appendPlatformAuditEvent,
  PLATFORM_AUDIT_ACTION_WORKSPACE_DEFINITION_PUBLISHED,
} from "./platform-audit-logger.ts";
import { PlatformValidation } from "./platform.errors.ts";
import { WorkspaceDefinitionRepository } from "../workspace-metadata/workspace-definition.repository.ts";

export type PublishPlatformWorkspaceDefinitionVersionResult = {
  readonly definitionId: string;
  readonly version: number;
  readonly checksum: string;
  readonly publishedAt: string;
};

export async function publishPlatformWorkspaceDefinitionVersion(input: {
  readonly definitionId: string;
  readonly payload: unknown;
  readonly actorId: string;
  readonly repository?: WorkspaceDefinitionRepository;
  readonly prisma?: Pick<PrismaClient, "$transaction" | "workspaceDefinition">;
}): Promise<PublishPlatformWorkspaceDefinitionVersionResult | null> {
  const repository = input.repository ?? new WorkspaceDefinitionRepository();
  const prisma = input.prisma ?? getPrismaAdmin();

  const definition = await repository.getDefinitionById(input.definitionId);
  if (!definition) {
    return null;
  }

  const validation = validateWorkspaceDefinitionPayload(
    mergeCommerceIntoWorkspaceDefinitionPayload(input.payload)
  );
  if (!validation.ok) {
    throw new PlatformValidation(validation.error.message);
  }
  const payload: WorkspaceDefinitionPayload = validation.value;
  if (payload.id !== input.definitionId) {
    throw new PlatformValidation(
      `payload.id must match definition path id (expected ${input.definitionId}, got ${payload.id})`
    );
  }

  assertWorkspaceDefinitionRendererAllowlist(payload);
  const checksum = computeWorkspaceDefinitionPayloadChecksum(payload);
  const version = await repository.getNextVersionNumber(input.definitionId);

  const publishedRow = await prisma.$transaction(async (tx) => {
    const row = await repository.createPublishedVersion(tx, {
      definitionId: input.definitionId,
      version,
      payload,
      checksum,
      createdByPlatformOpsUserId: input.actorId,
    });
    await tx.workspaceDefinition.update({
      where: { id: input.definitionId },
      data: { status: "published" },
    });
    await appendPlatformAuditEvent(tx, {
      action: PLATFORM_AUDIT_ACTION_WORKSPACE_DEFINITION_PUBLISHED,
      entityType: "workspace_definition",
      entityId: input.definitionId,
      actorId: input.actorId,
      metadata: {
        definitionId: input.definitionId,
        version,
        checksum,
        fieldCount: payload.fieldRegistry.fields.length,
        actorId: input.actorId,
      },
    });
    return row;
  });

  return {
    definitionId: publishedRow.definitionId,
    version: publishedRow.version,
    checksum: publishedRow.checksum,
    publishedAt: publishedRow.publishedAt?.toISOString() ?? new Date().toISOString(),
  };
}

export async function getPlatformWorkspaceDefinitionVersion(input: {
  readonly definitionId: string;
  readonly version: number;
  readonly repository?: WorkspaceDefinitionRepository;
}): Promise<{
  readonly definitionId: string;
  readonly version: number;
  readonly checksum: string;
  readonly publishedAt: string | null;
  readonly payload: unknown;
} | null> {
  const repository = input.repository ?? new WorkspaceDefinitionRepository();
  const definition = await repository.getDefinitionById(input.definitionId);
  if (!definition) {
    return null;
  }
  const row = await repository.getVersion(input.definitionId, input.version);
  if (!row) {
    return null;
  }
  return {
    definitionId: row.definitionId,
    version: row.version,
    checksum: row.checksum,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    payload: row.payload,
  };
}
