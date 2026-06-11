import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getWorkspaceDraftEventsRepository } from "./create-workspace-draft-events-repository";
import type { WorkspaceDraftEventAction } from "./workspace-draft-events.types";
import type { WorkspaceDraftRecord } from "./workspace-drafts.types";

export type WorkspaceDraftEventTarget = {
  readonly workspaceId: string;
  readonly draftNamespace: string;
  readonly draftKey: string;
};

export async function emitWorkspaceDraftEvent(
  auth: TenantAuthContext,
  params: WorkspaceDraftEventTarget,
  action: WorkspaceDraftEventAction,
  snapshot: Pick<WorkspaceDraftRecord, "version" | "schemaVersion"> | null
): Promise<void> {
  const repo = getWorkspaceDraftEventsRepository();
  await repo.append({
    tenantId: auth.tenantId,
    workspaceId: params.workspaceId,
    userId: auth.userId,
    draftNamespace: params.draftNamespace,
    draftKey: params.draftKey,
    action,
    version: snapshot?.version ?? null,
    schemaVersion: snapshot?.schemaVersion ?? 1,
    actorUserId: auth.userId,
  });
}
