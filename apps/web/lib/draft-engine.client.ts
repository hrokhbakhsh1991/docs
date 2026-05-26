import { DraftConflictError, type DraftSyncPayload } from "@repo/draft-engine";

function draftPath(workspaceId: string, draftKey: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/draft-engine/${encodeURIComponent(draftKey)}`;
}

function readConflictServer<T>(payload: unknown): DraftSyncPayload<T> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const server = (payload as { server?: unknown }).server;
  if (!server || typeof server !== "object" || Array.isArray(server)) {
    return null;
  }
  const record = server as { data?: unknown; version?: unknown; lastModified?: unknown };
  if (record.data == null || typeof record.version !== "number" || typeof record.lastModified !== "number") {
    return null;
  }
  return {
    data: record.data as T,
    version: record.version,
    lastModified: record.lastModified,
  };
}

export async function fetchDraftSnapshot<T>(
  workspaceId: string,
  draftKey: string,
): Promise<DraftSyncPayload<T> | null> {
  const res = await fetch(draftPath(workspaceId, draftKey), { credentials: "include" });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`fetchDraftSnapshot: ${res.status}`);
  }
  const body = (await res.json()) as DraftSyncPayload<T> | null;
  if (body == null || body.data == null) {
    return null;
  }
  return body;
}

export async function patchDraftSnapshot<T>(
  workspaceId: string,
  draftKey: string,
  payload: DraftSyncPayload<T>,
): Promise<DraftSyncPayload<T>> {
  const res = await fetch(draftPath(workspaceId, draftKey), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 409) {
    const conflictBody = (await res.json().catch(() => null)) as unknown;
    const server = readConflictServer<T>(conflictBody);
    if (server) {
      throw new DraftConflictError(server);
    }
    throw new Error("patchDraftSnapshot: conflict without server payload");
  }
  if (!res.ok) {
    throw new Error(`patchDraftSnapshot: ${res.status}`);
  }
  return (await res.json()) as DraftSyncPayload<T>;
}

export async function deleteDraftSnapshot(workspaceId: string, draftKey: string): Promise<void> {
  const res = await fetch(draftPath(workspaceId, draftKey), {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 404 || res.status === 204) {
    return;
  }
  if (!res.ok) {
    throw new Error(`deleteDraftSnapshot: ${res.status}`);
  }
}
