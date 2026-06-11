export type WorkspaceDraftSyncPayload = {
  readonly data: unknown;
  readonly version: number;
  readonly schemaVersion: number;
  readonly lastModified: number;
};

export type WorkspaceDraftRecord = WorkspaceDraftSyncPayload & {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly draftNamespace: string;
  readonly draftKey: string;
  readonly updatedByUserId: string;
  readonly updatedAt: string;
};

export type WorkspaceDraftKey = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly draftNamespace: string;
  readonly draftKey: string;
};

export type PatchWorkspaceDraftInput = WorkspaceDraftKey & {
  readonly expectedVersion: number;
  readonly data: unknown;
  readonly schemaVersion: number;
  readonly lastModified: number;
  readonly updatedByUserId: string;
};

/** Metadata row for GET /workspaces/{workspaceId}/drafts (11.9 — no `data` blob). */
export type WorkspaceDraftIndexItem = {
  readonly draftNamespace: string;
  readonly draftKey: string;
  readonly version: number;
  readonly schemaVersion: number;
  readonly lastModified: number;
  readonly updatedAt: string;
};

export type WorkspaceDraftListScope = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly draftNamespace?: string;
};
