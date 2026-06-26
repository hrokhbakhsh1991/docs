import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../../http/bind-request-context";
import { readJsonBody, sendJson, sendNoContent } from "../../http/json";
import { handleHttpError, sendHttpError } from "../../middleware/error-interceptor";
import { requireOperatorSession } from "../../identity/require-operator-session";
import {
  createWorkspaceIntegration,
  deleteIntegration,
  disableIntegration,
  enableIntegration,
  getIntegrationDetail,
  getWorkspaceIntegrationMeta,
  IntegrationConnectionAlreadyExistsError,
  IntegrationInvalidBodyError,
  IntegrationLegacyReadOnlyError,
  IntegrationNotFoundError,
  IntegrationSystemNotReadyError,
  IntegrationWorkspaceForbiddenError,
  listWorkspaceIntegrations,
  patchIntegration,
  testIntegrationConnection,
} from "./integrations.service";

function mapIntegrationRouteError(res: ServerResponse, error: unknown): void {
  if (error instanceof IntegrationSystemNotReadyError) {
    sendHttpError(res, 503, { error: "service_unavailable", code: error.code });
    return;
  }
  if (error instanceof IntegrationNotFoundError) {
    sendHttpError(res, 404, { error: "not_found", code: error.code });
    return;
  }
  if (error instanceof IntegrationWorkspaceForbiddenError) {
    sendHttpError(res, 403, { error: "forbidden", code: error.code });
    return;
  }
  if (error instanceof IntegrationLegacyReadOnlyError) {
    sendHttpError(res, 409, { error: "conflict", code: error.code });
    return;
  }
  if (error instanceof IntegrationConnectionAlreadyExistsError) {
    sendHttpError(res, 409, { error: "conflict", code: error.code });
    return;
  }
  if (error instanceof IntegrationInvalidBodyError) {
    sendHttpError(res, 400, { error: "invalid_body", code: error.code });
    return;
  }
  handleHttpError(res, error);
}

export async function handleCreateWorkspaceIntegration(
  req: IncomingMessage,
  res: ServerResponse,
  workspaceId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readJsonBody(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const created = await createWorkspaceIntegration(auth, workspaceId, body);
        sendJson(res, 201, created);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    mapIntegrationRouteError(res, error);
  }
}

export async function handleListWorkspaceIntegrations(
  req: IncomingMessage,
  res: ServerResponse,
  workspaceId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const payload = await listWorkspaceIntegrations(auth, workspaceId);
        sendJson(res, 200, payload);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    mapIntegrationRouteError(res, error);
  }
}

export async function handleGetWorkspaceIntegrationMeta(
  req: IncomingMessage,
  res: ServerResponse,
  workspaceId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const payload = await getWorkspaceIntegrationMeta(auth, workspaceId);
        sendJson(res, 200, payload);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    mapIntegrationRouteError(res, error);
  }
}

export async function handleGetIntegration(
  req: IncomingMessage,
  res: ServerResponse,
  integrationId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const detail = await getIntegrationDetail(auth, integrationId);
        sendJson(res, 200, detail);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    mapIntegrationRouteError(res, error);
  }
}

export async function handlePatchIntegration(
  req: IncomingMessage,
  res: ServerResponse,
  integrationId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readJsonBody(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const updated = await patchIntegration(auth, integrationId, body);
        sendJson(res, 200, updated);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    mapIntegrationRouteError(res, error);
  }
}

export async function handleDeleteIntegration(
  req: IncomingMessage,
  res: ServerResponse,
  integrationId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        await deleteIntegration(auth, integrationId);
        sendNoContent(res);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    mapIntegrationRouteError(res, error);
  }
}

export async function handleEnableIntegration(
  req: IncomingMessage,
  res: ServerResponse,
  integrationId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const updated = await enableIntegration(auth, integrationId);
        sendJson(res, 200, updated);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    mapIntegrationRouteError(res, error);
  }
}

export async function handleDisableIntegration(
  req: IncomingMessage,
  res: ServerResponse,
  integrationId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const updated = await disableIntegration(auth, integrationId);
        sendJson(res, 200, updated);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    mapIntegrationRouteError(res, error);
  }
}

export async function handleTestIntegrationConnection(
  req: IncomingMessage,
  res: ServerResponse,
  integrationId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await testIntegrationConnection(auth, integrationId);
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    mapIntegrationRouteError(res, error);
  }
}
