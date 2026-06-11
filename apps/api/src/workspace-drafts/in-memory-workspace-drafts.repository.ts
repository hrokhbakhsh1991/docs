import { WorkspaceDraftVersionConflictError } from "./workspace-draft-version-conflict";
import type {
  PatchWorkspaceDraftInput,
  WorkspaceDraftIndexItem,
  WorkspaceDraftKey,
  WorkspaceDraftListScope,
  WorkspaceDraftRecord,
  WorkspaceDraftSyncPayload,
} from "./workspace-drafts.types";

type StoreKey = string;

let draftStore = new Map<StoreKey, WorkspaceDraftRecord>();

function storeKeyFor(input: WorkspaceDraftKey): StoreKey {
  return `${input.tenantId}:${input.workspaceId}:${input.userId}:${input.draftNamespace}:${input.draftKey}`;
}

function cloneRecord(record: WorkspaceDraftRecord): WorkspaceDraftRecord {
  return {
    ...record,
    data: structuredClone(record.data),
  };
}

function toSyncPayload(record: WorkspaceDraftRecord): WorkspaceDraftSyncPayload {
  return {
    data: structuredClone(record.data),
    version: record.version,
    schemaVersion: record.schemaVersion,
    lastModified: record.lastModified,
  };
}

export function resetWorkspaceDraftsRepositoryForTests(): void {
  draftStore = new Map();
}

function toIndexItem(record: WorkspaceDraftRecord): WorkspaceDraftIndexItem {
  return {
    draftNamespace: record.draftNamespace,
    draftKey: record.draftKey,
    version: record.version,
    schemaVersion: record.schemaVersion,
    lastModified: record.lastModified,
    updatedAt: record.updatedAt,
  };
}

function matchesListScope(record: WorkspaceDraftRecord, scope: WorkspaceDraftListScope): boolean {
  if (record.tenantId !== scope.tenantId) {
    return false;
  }
  if (record.workspaceId !== scope.workspaceId) {
    return false;
  }
  if (record.userId !== scope.userId) {
    return false;
  }
  if (scope.draftNamespace !== undefined && record.draftNamespace !== scope.draftNamespace) {
    return false;
  }
  return true;
}

export interface WorkspaceDraftsRepository {
  get(key: WorkspaceDraftKey): Promise<WorkspaceDraftRecord | null>;
  listByScope(scope: WorkspaceDraftListScope): Promise<readonly WorkspaceDraftIndexItem[]>;
  patch(input: PatchWorkspaceDraftInput): Promise<WorkspaceDraftRecord>;
  delete(key: WorkspaceDraftKey): Promise<boolean>;
}

export class InMemoryWorkspaceDraftsRepository implements WorkspaceDraftsRepository {
  async get(key: WorkspaceDraftKey): Promise<WorkspaceDraftRecord | null> {
    const row = draftStore.get(storeKeyFor(key));
    return row === undefined ? null : cloneRecord(row);
  }

  async listByScope(scope: WorkspaceDraftListScope): Promise<readonly WorkspaceDraftIndexItem[]> {
    return [...draftStore.values()]
      .filter((record) => matchesListScope(record, scope))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(toIndexItem);
  }

  async patch(input: PatchWorkspaceDraftInput): Promise<WorkspaceDraftRecord> {
    const key = storeKeyFor(input);
    const existing = draftStore.get(key);

    if (existing === undefined) {
      if (input.expectedVersion !== 0) {
        throw new WorkspaceDraftVersionConflictError({
          data: {},
          version: 0,
          schemaVersion: 1,
          lastModified: 0,
        });
      }
      const created: WorkspaceDraftRecord = {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        userId: input.userId,
        draftNamespace: input.draftNamespace,
        draftKey: input.draftKey,
        data: structuredClone(input.data),
        version: 1,
        schemaVersion: input.schemaVersion,
        lastModified: input.lastModified,
        updatedByUserId: input.updatedByUserId,
        updatedAt: new Date().toISOString(),
      };
      draftStore.set(key, created);
      return cloneRecord(created);
    }

    if (existing.version !== input.expectedVersion) {
      throw new WorkspaceDraftVersionConflictError(toSyncPayload(existing));
    }

    const updated: WorkspaceDraftRecord = {
      ...existing,
      data: structuredClone(input.data),
      version: existing.version + 1,
      schemaVersion: input.schemaVersion,
      lastModified: input.lastModified,
      updatedByUserId: input.updatedByUserId,
      updatedAt: new Date().toISOString(),
    };
    draftStore.set(key, updated);
    return cloneRecord(updated);
  }

  async delete(key: WorkspaceDraftKey): Promise<boolean> {
    return draftStore.delete(storeKeyFor(key));
  }
}
