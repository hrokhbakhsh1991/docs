import type { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";
import { MAX_WORKSPACE_DRAFTS_PER_SCOPE } from "./workspace-drafts-list-projection";
import type { WorkspaceDraftsRepository } from "./in-memory-workspace-drafts.repository";
import { WorkspaceDraftVersionConflictError } from "./workspace-draft-version-conflict";
import type {
  PatchWorkspaceDraftInput,
  WorkspaceDraftIndexItem,
  WorkspaceDraftKey,
  WorkspaceDraftListScope,
  WorkspaceDraftRecord,
  WorkspaceDraftSyncPayload,
} from "./workspace-drafts.types";

function compositeWhere(key: WorkspaceDraftKey) {
  return {
    tenantId_workspaceId_userId_draftNamespace_draftKey: {
      tenantId: key.tenantId,
      workspaceId: key.workspaceId,
      userId: key.userId,
      draftNamespace: key.draftNamespace,
      draftKey: key.draftKey,
    },
  };
}

function toRecord(row: {
  tenantId: string;
  workspaceId: string;
  userId: string;
  draftNamespace: string;
  draftKey: string;
  schemaVersion: number;
  version: number;
  data: Prisma.JsonValue;
  lastModified: bigint;
  updatedByUserId: string;
  updatedAt: Date;
}): WorkspaceDraftRecord {
  return {
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    userId: row.userId,
    draftNamespace: row.draftNamespace,
    draftKey: row.draftKey,
    data: row.data,
    version: row.version,
    schemaVersion: row.schemaVersion,
    lastModified: Number(row.lastModified),
    updatedByUserId: row.updatedByUserId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSyncPayload(record: WorkspaceDraftRecord): WorkspaceDraftSyncPayload {
  return {
    data: record.data,
    version: record.version,
    schemaVersion: record.schemaVersion,
    lastModified: record.lastModified,
  };
}

export class PrismaWorkspaceDraftsRepository implements WorkspaceDraftsRepository {
  async get(key: WorkspaceDraftKey): Promise<WorkspaceDraftRecord | null> {
    const row = await withTenantRls(key.tenantId, (tx) =>
      tx.workspaceDraftSnapshot.findUnique({ where: compositeWhere(key) })
    );
    return row === null ? null : toRecord(row);
  }

  async listByScope(scope: WorkspaceDraftListScope): Promise<readonly WorkspaceDraftIndexItem[]> {
    const rows = await withTenantRls(scope.tenantId, (tx) =>
      tx.workspaceDraftSnapshot.findMany({
        where: {
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          userId: scope.userId,
          ...(scope.draftNamespace !== undefined ? { draftNamespace: scope.draftNamespace } : {}),
        },
        orderBy: { updatedAt: "desc" },
        select: {
          draftNamespace: true,
          draftKey: true,
          version: true,
          schemaVersion: true,
          lastModified: true,
          updatedAt: true,
        },
        take: MAX_WORKSPACE_DRAFTS_PER_SCOPE,
      })
    );

    return rows.map((row) => ({
      draftNamespace: row.draftNamespace,
      draftKey: row.draftKey,
      version: row.version,
      schemaVersion: row.schemaVersion,
      lastModified: Number(row.lastModified),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async patch(input: PatchWorkspaceDraftInput): Promise<WorkspaceDraftRecord> {
    return withTenantRls(input.tenantId, async (tx) => {
      const existing = await tx.workspaceDraftSnapshot.findUnique({
        where: compositeWhere(input),
      });

      if (existing === null) {
        if (input.expectedVersion !== 0) {
          throw new WorkspaceDraftVersionConflictError({
            data: {},
            version: 0,
            schemaVersion: 1,
            lastModified: 0,
          });
        }
        const created = await tx.workspaceDraftSnapshot.create({
          data: {
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            userId: input.userId,
            draftNamespace: input.draftNamespace,
            draftKey: input.draftKey,
            schemaVersion: input.schemaVersion,
            version: 1,
            data: input.data as Prisma.InputJsonValue,
            lastModified: BigInt(input.lastModified),
            updatedByUserId: input.updatedByUserId,
          },
        });
        return toRecord(created);
      }

      if (existing.version !== input.expectedVersion) {
        throw new WorkspaceDraftVersionConflictError(toSyncPayload(toRecord(existing)));
      }

      const updated = await tx.workspaceDraftSnapshot.update({
        where: compositeWhere(input),
        data: {
          schemaVersion: input.schemaVersion,
          version: existing.version + 1,
          data: input.data as Prisma.InputJsonValue,
          lastModified: BigInt(input.lastModified),
          updatedByUserId: input.updatedByUserId,
        },
      });
      return toRecord(updated);
    });
  }

  async delete(key: WorkspaceDraftKey): Promise<boolean> {
    const result = await withTenantRls(key.tenantId, (tx) =>
      tx.workspaceDraftSnapshot.deleteMany({
        where: {
          tenantId: key.tenantId,
          workspaceId: key.workspaceId,
          userId: key.userId,
          draftNamespace: key.draftNamespace,
          draftKey: key.draftKey,
        },
      })
    );
    return result.count > 0;
  }
}
