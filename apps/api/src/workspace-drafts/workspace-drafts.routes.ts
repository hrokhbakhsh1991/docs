import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { readIdentityRequestBody } from "../identity/read-identity-request-body";
import { requireOperatorSession } from "../identity/require-operator-session";
import { isWorkspaceDraftVersionConflictError } from "./workspace-draft-version-conflict";
import {
  WorkspaceDraftForbiddenError,
  WorkspaceDraftInvalidBodyError,
  WorkspaceDraftNotFoundError,
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
    const body = await readIdentityRequestBody(req);
    const parsed = parsePatchBody(body);
    if (parsed === null) {
      sendHttpError(res, 400, { error: "invalid_body", code: "WORKSPACE_DRAFT_INVALID_BODY" });
      return;
    }
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const payload = await patchWorkspaceDraft(auth, params, parsed);
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
      sendJson(res, 204, {});
    },
    "write"
  );
}
