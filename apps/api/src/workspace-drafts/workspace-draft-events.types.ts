import type { WorkspaceDraftKey } from "./workspace-drafts.types";

export const WORKSPACE_DRAFT_EVENT_ACTIONS = ["created", "updated", "deleted"] as const;

export type WorkspaceDraftEventAction = (typeof WORKSPACE_DRAFT_EVENT_ACTIONS)[number];

export type WorkspaceDraftEventRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly draftNamespace: string;
  readonly draftKey: string;
  readonly action: WorkspaceDraftEventAction;
  readonly version: number | null;
  readonly schemaVersion: number;
  readonly actorUserId: string;
  readonly occurredAt: string;
};

export type AppendWorkspaceDraftEventInput = WorkspaceDraftKey & {
  readonly action: WorkspaceDraftEventAction;
  readonly version: number | null;
  readonly schemaVersion: number;
  readonly actorUserId: string;
};

export type WorkspaceDraftEventListItem = {
  readonly id: string;
  readonly action: WorkspaceDraftEventAction;
  readonly version: number | null;
  readonly schemaVersion: number;
  readonly actorUserId: string;
  readonly occurredAt: string;
};
