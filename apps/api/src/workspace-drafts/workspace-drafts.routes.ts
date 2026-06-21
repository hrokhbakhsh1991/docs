import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import {
  hashIdempotentRequest,
  readIdempotencyKey,
  runIdempotentHttpMutation,
} from "../http/http-idempotency";
import { readRequestBodyRaw, sendJson, sendNoContent } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import { isWorkspaceDraftVersionConflictError } from "./workspace-draft-version-conflict";
import {
  WorkspaceDraftForbiddenError,
  WorkspaceDraftInvalidBodyError,
  WorkspaceDraftNotFoundError,
  WorkspaceDraftTombstoneInvariantError,
} from "./workspace-drafts.errors";
import {
  clampWorkspaceDraftEventsLimit,
  deleteWorkspaceDraft,
  getWorkspaceDraft,
  listWorkspaceDraftEvents,
  listWorkspaceDrafts,
  patchWorkspaceDraft,
  type WorkspaceDraftListRouteParams,
  type WorkspaceDraftRouteParams,
} from "./workspace-drafts.service";
import type { WorkspaceDraftSyncPayload } from "./workspace-drafts.types";

function handleWorkspaceDraftRouteError(res: ServerResponse, error: unknown): void {
  if (isWorkspaceDraftVersionConflictError(error)) {
    const payload = error.serverPayload;
    sendJson(res, 409, {
      error: error.message,
      code: error.code,
      data: payload.data,
      version: payload.version,
      schemaVersion: payload.schemaVersion,
      lastModified: payload.lastModified,
    });
    return;
  }
  if (error instanceof WorkspaceDraftForbiddenError) {
    sendHttpError(res, 403, { error: "forbidden", code: error.code });
    return;
  }
  if (error instanceof WorkspaceDraftNotFoundError) {
    sendHttpError(res, 404, { error: "not_found", code: error.code });
    return;
  }
  if (error instanceof WorkspaceDraftInvalidBodyError) {
    sendHttpError(res, 400, { error: "invalid_body", code: error.code });
    return;
  }
  if (error instanceof WorkspaceDraftTombstoneInvariantError) {
    sendHttpError(res, 400, {
      error: "tombstone_invariant_violation",
      code: error.code,
      ...(error.keys != null && error.keys.length > 0 ? { keys: error.keys } : {}),
    });
    return;
  }
  handleHttpError(res, error);
}

function parsePatchBody(body: unknown): WorkspaceDraftSyncPayload | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;
  if (!("data" in record)) {
    return null;
  }
  if (typeof record.version !== "number" || !Number.isFinite(record.version)) {
    return null;
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
    data: record.data,
    version: record.version,
    schemaVersion,
    lastModified,
  };
}

async function withWorkspaceDraftHandler(
  req: IncomingMessage,
  res: ServerResponse,
  run: (
    auth: Awaited<ReturnType<typeof requireOperatorSession>>
  ) => Promise<void>,
  rateLimit: "read" | "write"
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(req, auth, () => run(auth), { rateLimit });
  } catch (error) {
    handleWorkspaceDraftRouteError(res, error);
  }
}

function parseDraftListQuery(url: URL): WorkspaceDraftListRouteParams["draftNamespace"] {
  const namespace = url.searchParams.get("namespace")?.trim() ?? "";
  return namespace.length > 0 ? namespace : undefined;
}

function workspaceDraftPatchPath(params: WorkspaceDraftRouteParams): string {
  return `/workspaces/${params.workspaceId}/drafts/${params.draftNamespace}/${params.draftKey}`;
}

export async function handleListWorkspaceDrafts(
  req: IncomingMessage,
  res: ServerResponse,
  params: Pick<WorkspaceDraftListRouteParams, "workspaceId">
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const listParams: WorkspaceDraftListRouteParams = {
    workspaceId: params.workspaceId,
    draftNamespace: parseDraftListQuery(url),
  };

  await withWorkspaceDraftHandler(
    req,
    res,
    async (auth) => {
      const payload = await listWorkspaceDrafts(auth, listParams);
      sendJson(res, 200, payload);
    },
    "read"
  );
}

export async function handleListWorkspaceDraftEvents(
  req: IncomingMessage,
  res: ServerResponse,
  params: WorkspaceDraftRouteParams
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const limit = clampWorkspaceDraftEventsLimit(url.searchParams.get("limit"));

  await withWorkspaceDraftHandler(
    req,
    res,
    async (auth) => {
      const payload = await listWorkspaceDraftEvents(auth, params, limit);
      sendJson(res, 200, payload);
    },
    "read"
  );
}

export async function handleGetWorkspaceDraft(
  req: IncomingMessage,
  res: ServerResponse,
  params: WorkspaceDraftRouteParams
): Promise<void> {
  await withWorkspaceDraftHandler(
    req,
    res,
    async (auth) => {
      const payload = await getWorkspaceDraft(auth, params);
      sendJson(res, 200, payload);
    },
    "read"
  );
}

export async function handlePatchWorkspaceDraft(
  req: IncomingMessage,
  res: ServerResponse,
  params: WorkspaceDraftRouteParams
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const rawBody = await readRequestBodyRaw(req);
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody) as unknown;
    } catch {
      sendHttpError(res, 400, { error: "invalid_body", code: "WORKSPACE_DRAFT_INVALID_BODY" });
      return;
    }
    const parsed = parsePatchBody(parsedBody);
    if (parsed === null) {
      sendHttpError(res, 400, { error: "invalid_body", code: "WORKSPACE_DRAFT_INVALID_BODY" });
      return;
    }
    const idempotencyKey = readIdempotencyKey(req);
    const patchPath = workspaceDraftPatchPath(params);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const executePatch = async (): Promise<Record<string, unknown>> => {
          const payload = await patchWorkspaceDraft(auth, params, parsed);
          return payload as Record<string, unknown>;
        };

        if (idempotencyKey === undefined) {
          sendJson(res, 200, await executePatch());
          return;
        }

        const requestHash = hashIdempotentRequest("PATCH", patchPath, rawBody);
        const payload = await runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          executePatch
        );
        sendJson(res, 200, payload);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleWorkspaceDraftRouteError(res, error);
  }
}

export async function handleDeleteWorkspaceDraft(
  req: IncomingMessage,
  res: ServerResponse,
  params: WorkspaceDraftRouteParams
): Promise<void> {
  await withWorkspaceDraftHandler(
    req,
    res,
    async (auth) => {
      await deleteWorkspaceDraft(auth, params);
      sendNoContent(res);
    },
    "write"
  );
}
