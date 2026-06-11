import { randomUUID } from "node:crypto";

import type {
  AppendWorkspaceDraftEventInput,
  WorkspaceDraftEventRecord,
} from "./workspace-draft-events.types";
import type { WorkspaceDraftKey } from "./workspace-drafts.types";

let eventStore: WorkspaceDraftEventRecord[] = [];

export function resetWorkspaceDraftEventsRepositoryForTests(): void {
  eventStore = [];
}

export interface WorkspaceDraftEventsRepository {
  append(input: AppendWorkspaceDraftEventInput): Promise<WorkspaceDraftEventRecord>;
  listByDraft(
    key: WorkspaceDraftKey,
    limit: number
  ): Promise<readonly WorkspaceDraftEventRecord[]>;
}

function draftScopeMatches(
  record: WorkspaceDraftEventRecord,
  key: WorkspaceDraftKey
): boolean {
  return (
    record.tenantId === key.tenantId &&
    record.workspaceId === key.workspaceId &&
    record.userId === key.userId &&
    record.draftNamespace === key.draftNamespace &&
    record.draftKey === key.draftKey
  );
}

export class InMemoryWorkspaceDraftEventsRepository implements WorkspaceDraftEventsRepository {
  async append(input: AppendWorkspaceDraftEventInput): Promise<WorkspaceDraftEventRecord> {
    const created: WorkspaceDraftEventRecord = {
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
      occurredAt: new Date().toISOString(),
    };
    eventStore.push(created);
    return { ...created };
  }

  async listByDraft(
    key: WorkspaceDraftKey,
    limit: number
  ): Promise<readonly WorkspaceDraftEventRecord[]> {
    return eventStore
      .filter((record) => draftScopeMatches(record, key))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, limit)
      .map((record) => ({ ...record }));
  }
}
