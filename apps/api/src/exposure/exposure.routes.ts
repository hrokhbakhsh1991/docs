import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { readJsonBody, sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import {
  ExposureCatalogFieldNotAllowedError,
  ExposureWorkspaceForbiddenError,
  getWorkspaceExposureCatalog,
} from "./exposure-catalog.service";
import { getWorkspaceExposureControlPlane } from "./exposure-control-plane.service";
import {
  ExposureEnginePreviewInvalidQueryError,
  ExposureEnginePreviewUnavailableError,
  getExposureEnginePreview,
} from "./exposure-engine-preview.service";
import {
  diffExposureSimulation,
  ExposureSimulationInvalidBodyError,
  simulateExposure,
} from "./exposure-simulation.service";
import { IntegrationNotFoundError } from "../integrations/http/integrations.service";
import {
  getWorkspaceExposureSurfaces,
  patchWorkspaceSurfaceExposureIntent,
} from "./workspace-exposure-surfaces.service";
import {
  SettingsModuleNotSupportedError,
  SettingsMutationForbiddenError,
} from "../settings/settings.service";
import { SettingsWorkspaceForbiddenError } from "../settings/settings-workspace-guard";

function mapExposureRouteError(res: ServerResponse, error: unknown): void {
  if (error instanceof SettingsMutationForbiddenError) {
    sendHttpError(res, 403, { error: "forbidden", code: error.code });
    return;
  }
  if (error instanceof SettingsWorkspaceForbiddenError) {
    sendHttpError(res, 403, { error: "forbidden", code: error.code });
    return;
  }
  if (error instanceof SettingsModuleNotSupportedError) {
    sendHttpError(res, 404, { error: "not_found", code: error.code, moduleId: error.moduleId });
    return;
  }
  if (error instanceof ExposureWorkspaceForbiddenError) {
    sendHttpError(res, 403, { error: "forbidden", code: error.code });
    return;
  }
  if (error instanceof ExposureEnginePreviewInvalidQueryError) {
    sendHttpError(res, 400, { error: "invalid_query", code: error.code, message: error.message });
    return;
  }
  if (error instanceof ExposureEnginePreviewUnavailableError) {
    sendHttpError(res, 422, { error: "unavailable", code: error.code, message: error.message });
    return;
  }
  if (error instanceof ExposureSimulationInvalidBodyError) {
    sendHttpError(res, 400, { error: "invalid_body", code: error.code, message: error.message });
    return;
  }
  if (error instanceof ExposureCatalogFieldNotAllowedError) {
    sendHttpError(res, 400, { error: "invalid_body", code: error.code, message: error.message });
    return;
  }
  if (error instanceof IntegrationNotFoundError) {
    sendHttpError(res, 404, { error: "not_found", code: error.code });
    return;
  }
  handleHttpError(res, error);
}

export async function handleGetWorkspaceExposureCatalog(
  req: IncomingMessage,
  res: ServerResponse,
  workspaceId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const payload = await getWorkspaceExposureCatalog(auth, workspaceId);
        sendJson(res, 200, payload);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    mapExposureRouteError(res, error);
  }
}

export async function handleGetWorkspaceExposureControlPlane(
  req: IncomingMessage,
  res: ServerResponse,
  workspaceId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const payload = await getWorkspaceExposureControlPlane(auth, workspaceId);
        sendJson(res, 200, payload);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    mapExposureRouteError(res, error);
  }
}

export async function handleGetExposureEnginePreview(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const url = new URL(req.url ?? "/", "http://localhost");
    const connectionId = url.searchParams.get("connectionId");
    const eventType = url.searchParams.get("eventType");
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const payload = await getExposureEnginePreview(auth, { connectionId, eventType });
        sendJson(res, 200, payload);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    mapExposureRouteError(res, error);
  }
}

export async function handlePostExposureSimulation(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readJsonBody<unknown>(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const payload = await simulateExposure(auth, body);
        sendJson(res, 200, payload);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    mapExposureRouteError(res, error);
  }
}

export async function handlePostExposureDiff(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readJsonBody<unknown>(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const payload = await diffExposureSimulation(auth, body);
        sendJson(res, 200, payload);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    mapExposureRouteError(res, error);
  }
}

export async function handleGetWorkspaceExposureSurfaces(
  req: IncomingMessage,
  res: ServerResponse,
  workspaceId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const payload = await getWorkspaceExposureSurfaces(auth, workspaceId);
        sendJson(res, 200, payload);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    mapExposureRouteError(res, error);
  }
}

export async function handlePatchWorkspaceSurfaceExposureIntent(
  req: IncomingMessage,
  res: ServerResponse,
  workspaceId: string,
  surfaceKey: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readJsonBody<Record<string, unknown>>(req);
    const selectedFieldIds = Array.isArray(body.selectedFieldIds)
      ? body.selectedFieldIds.filter((value): value is string => typeof value === "string")
      : [];
    const audience = typeof body.audience === "string" ? body.audience : "";
    const trigger = typeof body.trigger === "string" ? body.trigger : "";
    const enabled = body.enabled === true;
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const intent = await patchWorkspaceSurfaceExposureIntent(auth, workspaceId, {
          surface: decodeURIComponent(surfaceKey),
          audience,
          trigger,
          selectedFieldIds,
          enabled,
          updatedByUserId: auth.userId,
        });
        sendJson(res, 200, { intent });
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    mapExposureRouteError(res, error);
  }
}
