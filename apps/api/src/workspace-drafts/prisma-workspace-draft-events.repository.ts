import { randomUUID } from "node:crypto";

import { withTenantRls } from "../db/with-tenant-rls";
import type { WorkspaceDraftEventsRepository } from "./in-memory-workspace-draft-events.repository";
import type {
  AppendWorkspaceDraftEventInput,
  WorkspaceDraftEventRecord,
} from "./workspace-draft-events.types";
import type { WorkspaceDraftKey } from "./workspace-drafts.types";

function toRecord(row: {
  id: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  draftNamespace: string;
  draftKey: string;
  action: string;
  version: number | null;
  schemaVersion: number;
  actorUserId: string;
  occurredAt: Date;
}): WorkspaceDraftEventRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    userId: row.userId,
    draftNamespace: row.draftNamespace,
    draftKey: row.draftKey,
    action: row.action as WorkspaceDraftEventRecord["action"],
    version: row.version,
    schemaVersion: row.schemaVersion,
    actorUserId: row.actorUserId,
    occurredAt: row.occurredAt.toISOString(),
  };
}

export class PrismaWorkspaceDraftEventsRepository implements WorkspaceDraftEventsRepository {
  async append(input: AppendWorkspaceDraftEventInput): Promise<WorkspaceDraftEventRecord> {
    const row = await withTenantRls(input.tenantId, (tx) =>
      tx.workspaceDraftEvent.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          userId: input.userId,
          draftNamespace: input.draftNamespace,
          draftKey: input.draftKey,
          action: input.action,
          version: input.version,
          schemaVersion: input.schemaVersion,
          actorUserId: input.actorUserId,
        },
      })
    );
    return toRecord(row);
  }

  async listByDraft(
    key: WorkspaceDraftKey,
    limit: number
  ): Promise<readonly WorkspaceDraftEventRecord[]> {
    const rows = await withTenantRls(key.tenantId, (tx) =>
      tx.workspaceDraftEvent.findMany({
        where: {
          tenantId: key.tenantId,
          workspaceId: key.workspaceId,
          userId: key.userId,
          draftNamespace: key.draftNamespace,
          draftKey: key.draftKey,
        },
        orderBy: [{ occurredAt: "desc" }, { version: "desc" }, { id: "desc" }],
        take: limit,
      })
    );
    return rows.map(toRecord);
  }
}
