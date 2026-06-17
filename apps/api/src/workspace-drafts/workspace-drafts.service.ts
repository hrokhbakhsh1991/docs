import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getActiveWorkspaceType } from "../tenant/tenant-request-context";
import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";
import { getWorkspaceDraftEventsRepository } from "./create-workspace-draft-events-repository";
import { getWorkspaceDraftsRepository } from "./create-workspace-drafts-repository";
import {
  WorkspaceDraftForbiddenError,
  WorkspaceDraftInvalidBodyError,
  WorkspaceDraftNotFoundError,
  WorkspaceDraftTombstoneInvariantError,
} from "./workspace-drafts.errors";
import { emitWorkspaceDraftEvent } from "./workspace-draft-events-emitter";
import {
  assertEnvelopeTombstoneInvariants,
  ENVELOPE_TOMBSTONE_PATCH_NAMESPACES,
} from "./invariants/envelope-tombstone-invariants";
import { reapplyServerEnvelopeTombstones } from "./reapply-server-envelope-tombstones";
import type {
  WorkspaceDraftEventListItem,
  WorkspaceDraftEventRecord,
} from "./workspace-draft-events.types";
import type {
  WorkspaceDraftIndexItem,
  WorkspaceDraftSyncPayload,
} from "./workspace-drafts.types";

export type WorkspaceDraftRouteParams = {
  readonly workspaceId: string;
  readonly draftNamespace: string;
  readonly draftKey: string;
};

export type WorkspaceDraftListRouteParams = {
  readonly workspaceId: string;
  readonly draftNamespace?: string;
};

function assertWorkspaceDraftScope(auth: TenantAuthContext, workspaceId: string): void {
  if (auth.workspaceId !== undefined && auth.workspaceId !== workspaceId) {
    throw new WorkspaceDraftForbiddenError();
  }
}

function draftKeyFor(auth: TenantAuthContext, params: WorkspaceDraftRouteParams) {
  return {
    tenantId: auth.tenantId,
    workspaceId: params.workspaceId,
    userId: auth.userId,
    draftNamespace: params.draftNamespace,
    draftKey: params.draftKey,
  };
}

export function toWorkspaceDraftSyncPayload(record: {
  data: unknown;
  version: number;
  schemaVersion: number;
  lastModified: number;
}): WorkspaceDraftSyncPayload {
  return {
    data: record.data,
    version: record.version,
    schemaVersion: record.schemaVersion,
    lastModified: record.lastModified,
  };
}

export async function listWorkspaceDrafts(
  auth: TenantAuthContext,
  params: WorkspaceDraftListRouteParams
): Promise<{ readonly items: readonly WorkspaceDraftIndexItem[] }> {
  assertWorkspaceDraftScope(auth, params.workspaceId);
  const repo = getWorkspaceDraftsRepository();
  const items = await repo.listByScope({
    tenantId: auth.tenantId,
    workspaceId: params.workspaceId,
    userId: auth.userId,
    draftNamespace: params.draftNamespace,
  });
  return { items };
}

export async function getWorkspaceDraft(
  auth: TenantAuthContext,
  params: WorkspaceDraftRouteParams
): Promise<WorkspaceDraftSyncPayload> {
  assertWorkspaceDraftScope(auth, params.workspaceId);
  const repo = getWorkspaceDraftsRepository();
  const row = await repo.get(draftKeyFor(auth, params));
  if (row === null) {
    throw new WorkspaceDraftNotFoundError();
  }
  return toWorkspaceDraftSyncPayload(row);
}

export async function patchWorkspaceDraft(
  auth: TenantAuthContext,
  params: WorkspaceDraftRouteParams,
  body: WorkspaceDraftSyncPayload
): Promise<WorkspaceDraftSyncPayload> {
  assertWorkspaceDraftScope(auth, params.workspaceId);

  const repo = getWorkspaceDraftsRepository();
  const key = draftKeyFor(auth, params);
  let dataToPersist = body.data;

  if (ENVELOPE_TOMBSTONE_PATCH_NAMESPACES.has(params.draftNamespace)) {
    const existing = await repo.get(key);
    const workspaceType = getActiveWorkspaceType() ?? "starter";
    const plugin = resolveWorkspacePluginForType(workspaceType);
    dataToPersist = reapplyServerEnvelopeTombstones(
      existing?.data,
      body.data,
      plugin.draftTombstone,
    );
    const tombstoneCheck = assertEnvelopeTombstoneInvariants(dataToPersist);
    if (!tombstoneCheck.ok) {
      await emitWorkspaceDraftEvent(auth, params, "tombstone_violation", null);
      throw new WorkspaceDraftTombstoneInvariantError(tombstoneCheck.code, tombstoneCheck.keys);
    }
  }

  const action = body.version === 0 ? "created" : "updated";
  const row = await repo.patch({
    ...key,
    expectedVersion: body.version,
    data: dataToPersist,
    schemaVersion: body.schemaVersion,
    lastModified: body.lastModified,
    updatedByUserId: auth.userId,
  });
  await emitWorkspaceDraftEvent(auth, params, action, row);
  return toWorkspaceDraftSyncPayload(row);
}

export async function deleteWorkspaceDraft(
  auth: TenantAuthContext,
  params: WorkspaceDraftRouteParams
): Promise<void> {
  assertWorkspaceDraftScope(auth, params.workspaceId);
  const repo = getWorkspaceDraftsRepository();
  const key = draftKeyFor(auth, params);
  const existing = await repo.get(key);
  if (existing === null) {
    throw new WorkspaceDraftNotFoundError();
  }
  const deleted = await repo.delete(key);
  if (!deleted) {
    throw new WorkspaceDraftNotFoundError();
  }
  await emitWorkspaceDraftEvent(auth, params, "deleted", existing);
}

const DEFAULT_DRAFT_EVENTS_LIMIT = 50;
const MAX_DRAFT_EVENTS_LIMIT = 100;

export function clampWorkspaceDraftEventsLimit(raw: string | null | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_DRAFT_EVENTS_LIMIT;
  }
  return Math.min(parsed, MAX_DRAFT_EVENTS_LIMIT);
}

function toWorkspaceDraftEventListItem(
  record: WorkspaceDraftEventRecord
): WorkspaceDraftEventListItem {
  return {
    id: record.id,
    action: record.action,
    version: record.version,
    schemaVersion: record.schemaVersion,
    actorUserId: record.actorUserId,
    occurredAt: record.occurredAt,
  };
}

export async function listWorkspaceDraftEvents(
  auth: TenantAuthContext,
  params: WorkspaceDraftRouteParams,
  limit: number
): Promise<{ readonly items: readonly WorkspaceDraftEventListItem[] }> {
  assertWorkspaceDraftScope(auth, params.workspaceId);
  const repo = getWorkspaceDraftEventsRepository();
  const items = await repo.listByDraft(draftKeyFor(auth, params), limit);
  return { items: items.map(toWorkspaceDraftEventListItem) };
}
