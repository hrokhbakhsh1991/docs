import type { IncomingMessage, ServerResponse } from "node:http";

import {
  DENALI_MAX_PHOTO_UPLOAD_BYTES,
  ensureMinioPhotoBucket,
  getDenaliTourPhotoSignedReadUrl,
  putDenaliWizardDraftPhoto,
  readMinioPhotoConfigFromEnv,
} from "@app-tour/workspace-denali";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { readBinaryRequestBody } from "../http/read-binary-body";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readHeader(req: IncomingMessage, name: string): string {
  const raw = req.headers[name.toLowerCase()];
  if (raw === undefined) {
    return "";
  }
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

function parseWizardPhotoUploadHeaders(req: IncomingMessage): {
  readonly sessionId: string;
  readonly photoId: string;
  readonly contentType: string;
} {
  const sessionId = readHeader(req, "x-wizard-session-id");
  const photoId = readHeader(req, "x-photo-id");
  const contentType = readHeader(req, "content-type").toLowerCase();

  if (!UUID_PATTERN.test(sessionId)) {
    throw new Error("ZOD_VALIDATION_FAILED: x-wizard-session-id must be a UUID");
  }
  if (!UUID_PATTERN.test(photoId)) {
    throw new Error("ZOD_VALIDATION_FAILED: x-photo-id must be a UUID");
  }
  if (contentType.length === 0) {
    throw new Error("ZOD_VALIDATION_FAILED: Content-Type is required");
  }

  return { sessionId, photoId, contentType };
}

export async function handleUploadWizardPhoto(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    if (workspaceType !== "denali") {
      sendHttpError(res, 403, {
        error: "forbidden",
        code: "WIZARD_PHOTO_UPLOAD_FORBIDDEN",
      });
      return;
    }

    const minioConfig = readMinioPhotoConfigFromEnv();
    if (minioConfig === null) {
      sendHttpError(res, 503, {
        error: "service_unavailable",
        code: "MINIO_NOT_CONFIGURED",
      });
      return;
    }

    const headers = parseWizardPhotoUploadHeaders(req);
    const body = await readBinaryRequestBody(req, DENALI_MAX_PHOTO_UPLOAD_BYTES);
    if (body.length === 0) {
      sendHttpError(res, 400, { error: "invalid_body", code: "WIZARD_PHOTO_EMPTY" });
      return;
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        await ensureMinioPhotoBucket(minioConfig);
        const { key } = await putDenaliWizardDraftPhoto({
          config: minioConfig,
          tenantId: auth.tenantId,
          sessionId: headers.sessionId,
          photoId: headers.photoId,
          body,
          contentType: headers.contentType,
        });
        sendJson(res, 201, {
          storageKey: key,
          photoId: headers.photoId,
          contentType: headers.contentType,
        });
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleGetWizardPhotoUrl(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    if (workspaceType !== "denali") {
      sendHttpError(res, 403, {
        error: "forbidden",
        code: "WIZARD_PHOTO_READ_FORBIDDEN",
      });
      return;
    }

    const minioConfig = readMinioPhotoConfigFromEnv();
    if (minioConfig === null) {
      sendHttpError(res, 503, {
        error: "service_unavailable",
        code: "MINIO_NOT_CONFIGURED",
      });
      return;
    }

    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const storageKey = url.searchParams.get("storageKey")?.trim() ?? "";
    if (storageKey.length === 0) {
      sendHttpError(res, 400, { error: "invalid_query", code: "WIZARD_PHOTO_KEY_REQUIRED" });
      return;
    }

    const draftPrefix = `${auth.tenantId}/wizard-drafts/`;
    if (!storageKey.startsWith(draftPrefix)) {
      sendHttpError(res, 403, { error: "forbidden", code: "WIZARD_PHOTO_KEY_FORBIDDEN" });
      return;
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const signedUrl = await getDenaliTourPhotoSignedReadUrl({
          config: minioConfig,
          tenantId: auth.tenantId,
          key: storageKey,
          expiresInSeconds: 300,
        });
        sendJson(res, 200, { url: signedUrl, storageKey });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
