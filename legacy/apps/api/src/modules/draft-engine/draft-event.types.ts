export type DraftEventType = "draft_saved" | "draft_deleted" | "draft_conflict";

export type InsertDraftEventInput = {
  workspaceId: string;
  userId: string;
  draftKey: string;
  eventType: DraftEventType;
  traceId: string | null;
  baseVersion: number | null;
  nextVersion: number | null;
  payloadSnapshot: Record<string, unknown>;
};
