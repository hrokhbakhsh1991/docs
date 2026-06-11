import { DraftConflictError, type DraftSyncPayload } from "@app-tour/draft-engine";

import type {
  WorkspaceDraftEventListItem,
  WorkspaceDraftEventsResponse,
  WorkspaceDraftIndexItem,
  WorkspaceDraftIndexResponse,
} from "./workspace-draft-types";

function draftBffPath(workspaceId: string, namespace: string, key: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/drafts/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`;
}

function draftListBffPath(workspaceId: string, namespace?: string): string {
  const base = `/api/workspaces/${encodeURIComponent(workspaceId)}/drafts`;
  return namespace === undefined || namespace.trim().length === 0
    ? base
    : `${base}?namespace=${encodeURIComponent(namespace)}`;
}

function draftEventsBffPath(
  workspaceId: string,
  namespace: string,
  key: string,
  limit?: number
): string {
  const base = `/api/workspaces/${encodeURIComponent(workspaceId)}/drafts/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}/events`;
  return limit === undefined ? base : `${base}?limit=${encodeURIComponent(String(limit))}`;
}

function parseWorkspaceDraftIndexItem(value: unknown): WorkspaceDraftIndexItem | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.draftNamespace !== "string" ||
    typeof record.draftKey !== "string" ||
    typeof record.version !== "number" ||
    !Number.isFinite(record.version) ||
    typeof record.schemaVersion !== "number" ||
    !Number.isFinite(record.schemaVersion) ||
    typeof record.lastModified !== "number" ||
    !Number.isFinite(record.lastModified) ||
    typeof record.updatedAt !== "string"
  ) {
    return null;
  }
  return {
    draftNamespace: record.draftNamespace,
    draftKey: record.draftKey,
    version: record.version,
    schemaVersion: record.schemaVersion,
    lastModified: record.lastModified,
    updatedAt: record.updatedAt,
  };
}

function parseWorkspaceDraftIndexResponse(body: unknown): WorkspaceDraftIndexResponse {
  if (typeof body !== "object" || body === null) {
    throw new Error("WORKSPACE_DRAFT_INDEX_INVALID_RESPONSE");
  }
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    throw new Error("WORKSPACE_DRAFT_INDEX_INVALID_RESPONSE");
  }
  const items = record.items
    .map((item) => parseWorkspaceDraftIndexItem(item))
    .filter((item): item is WorkspaceDraftIndexItem => item !== null);
  return { items };
}

function parseWorkspaceDraftEventItem(value: unknown): WorkspaceDraftEventListItem | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    (record.action !== "created" && record.action !== "updated" && record.action !== "deleted") ||
    (record.version !== null &&
      (typeof record.version !== "number" || !Number.isFinite(record.version))) ||
    typeof record.schemaVersion !== "number" ||
    !Number.isFinite(record.schemaVersion) ||
    typeof record.actorUserId !== "string" ||
    typeof record.occurredAt !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    action: record.action,
    version: record.version as number | null,
    schemaVersion: record.schemaVersion,
    actorUserId: record.actorUserId,
    occurredAt: record.occurredAt,
  };
}

function parseWorkspaceDraftEventsResponse(body: unknown): WorkspaceDraftEventsResponse {
  if (typeof body !== "object" || body === null) {
    throw new Error("WORKSPACE_DRAFT_EVENTS_INVALID_RESPONSE");
  }
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    throw new Error("WORKSPACE_DRAFT_EVENTS_INVALID_RESPONSE");
  }
  const items = record.items
    .map((item) => parseWorkspaceDraftEventItem(item))
    .filter((item): item is WorkspaceDraftEventListItem => item !== null);
  return { items };
}

export async function fetchWorkspaceDraftEvents(
  workspaceId: string,
  namespace: string,
  key: string,
  limit?: number
): Promise<WorkspaceDraftEventsResponse> {
  const response = await fetch(draftEventsBffPath(workspaceId, namespace, key, limit), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`WORKSPACE_DRAFT_EVENTS_FETCH_FAILED:${response.status}`);
  }
  const body = (await response.json()) as unknown;
  return parseWorkspaceDraftEventsResponse(body);
}

export async function fetchWorkspaceDraftIndex(
  workspaceId: string,
  namespace?: string
): Promise<WorkspaceDraftIndexResponse> {
  const response = await fetch(draftListBffPath(workspaceId, namespace), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`WORKSPACE_DRAFT_INDEX_FETCH_FAILED:${response.status}`);
  }
  const body = (await response.json()) as unknown;
  return parseWorkspaceDraftIndexResponse(body);
}

function parseDraftSyncPayload<T>(body: unknown): DraftSyncPayload<T> {
  if (typeof body !== "object" || body === null) {
    throw new Error("WORKSPACE_DRAFT_INVALID_RESPONSE");
  }
  const record = body as Record<string, unknown>;
  if (!("data" in record)) {
    throw new Error("WORKSPACE_DRAFT_INVALID_RESPONSE");
  }
  if (typeof record.version !== "number" || !Number.isFinite(record.version)) {
    throw new Error("WORKSPACE_DRAFT_INVALID_RESPONSE");
  }
  const schemaVersion =
    typeof record.schemaVersion === "number" && Number.isFinite(record.schemaVersion)
      ? record.schemaVersion
      : 1;
  const lastModified =
    typeof record.lastModified === "number" && Number.isFinite(record.lastModified)
      ? record.lastModified
      : Date.now();
  return {
    data: record.data as T,
    version: record.version,
    schemaVersion,
    lastModified,
  };
}

export async function fetchWorkspaceDraftSnapshot<T>(
  workspaceId: string,
  namespace: string,
  key: string
): Promise<DraftSyncPayload<T> | null> {
  const response = await fetch(draftBffPath(workspaceId, namespace, key), {
    method: "GET",
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`WORKSPACE_DRAFT_FETCH_FAILED:${response.status}`);
  }
  const body = (await response.json()) as unknown;
  return parseDraftSyncPayload<T>(body);
}

export async function patchWorkspaceDraftSnapshot<T>(
  workspaceId: string,
  namespace: string,
  key: string,
  payload: DraftSyncPayload<T>
): Promise<DraftSyncPayload<T>> {
  const response = await fetch(draftBffPath(workspaceId, namespace, key), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = (await response.json()) as unknown;
  if (response.status === 409) {
    throw new DraftConflictError(parseDraftSyncPayload<T>(body));
  }
  if (!response.ok) {
    throw new Error(`WORKSPACE_DRAFT_PATCH_FAILED:${response.status}`);
  }
  return parseDraftSyncPayload<T>(body);
}

export async function deleteWorkspaceDraftSnapshot(
  workspaceId: string,
  namespace: string,
  key: string
): Promise<void> {
  const response = await fetch(draftBffPath(workspaceId, namespace, key), {
    method: "DELETE",
    cache: "no-store",
  });
  if (response.status === 404 || response.status === 204) {
    return;
  }
  if (!response.ok) {
    throw new Error(`WORKSPACE_DRAFT_DELETE_FAILED:${response.status}`);
  }
}
