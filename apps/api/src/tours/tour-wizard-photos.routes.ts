import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { readBinaryRequestBody } from "../http/read-binary-body";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";

import {
  resolveWizardMediaBinding,
  type WorkspaceWizardMediaBinding,
} from "./workspace-wizard-media-dispatch";

function readHeader(req: IncomingMessage, name: string): string {
  const raw = req.headers[name.toLowerCase()];
  if (raw === undefined) {
    return "";
  }
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

function parseWizardPhotoUploadHeaders(
  req: IncomingMessage,
  media: WorkspaceWizardMediaBinding
): {
  readonly sessionId: string;
  readonly photoId: string;
  readonly contentType: string;
} {
  const sessionId = readHeader(req, "x-wizard-session-id");
  const photoId = readHeader(req, "x-photo-id");
  const contentType = readHeader(req, "content-type").toLowerCase();

  if (!media.isSessionId(sessionId)) {
    throw new Error("ZOD_VALIDATION_FAILED: x-wizard-session-id must be a UUID");
  }
  if (!media.isSessionId(photoId)) {
    throw new Error("ZOD_VALIDATION_FAILED: x-photo-id must be a UUID");
  }
  if (contentType.length === 0) {
    throw new Error("ZOD_VALIDATION_FAILED: Content-Type is required");
  }

  return { sessionId, photoId, contentType };
}

export function readWizardPhotoDomainErrorCode(message: string): string | null {
  const token = message.split(":", 1)[0]?.trim() ?? "";
  return /^[A-Z0-9_]+_PHOTO_[A-Z0-9_]+$/.test(token) ? token : null;
}

/** Same message-code pattern as `mapBrandingError` in tenant-branding.routes.ts. */
function mapWizardPhotoError(res: ServerResponse, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "MINIO_NOT_CONFIGURED") {
    sendHttpError(res, 503, { error: "service_unavailable", code: "MINIO_NOT_CONFIGURED" });
    return;
  }
  if (message === "PHOTO_STORAGE_FULL") {
    sendHttpError(res, 507, { error: "storage_full", code: "PHOTO_STORAGE_FULL" });
    return;
  }
  if (message === "PHOTO_STORAGE_UNAVAILABLE") {
    sendHttpError(res, 503, { error: "service_unavailable", code: "PHOTO_STORAGE_UNAVAILABLE" });
    return;
  }
  const photoDomainCode = readWizardPhotoDomainErrorCode(message);
  if (photoDomainCode !== null) {
    sendHttpError(res, 400, { error: "invalid_body", code: photoDomainCode });
    return;
  }
  handleHttpError(res, error);
}

export async function handleUploadWizardPhoto(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    const media = resolveWizardMediaBinding(workspaceType);
    if (media === undefined) {
      sendHttpError(res, 403, {
        error: "forbidden",
        code: "WIZARD_PHOTO_UPLOAD_FORBIDDEN",
      });
      return;
    }

    const minioConfig = media.readPhotoConfigFromEnv();
    if (minioConfig === null) {
      sendHttpError(res, 503, {
        error: "service_unavailable",
        code: "MINIO_NOT_CONFIGURED",
      });
      return;
    }

    const headers = parseWizardPhotoUploadHeaders(req, media);
    const body = await readBinaryRequestBody(req, media.maxUploadBytes);
    if (body.length === 0) {
      sendHttpError(res, 400, { error: "invalid_body", code: "WIZARD_PHOTO_EMPTY" });
      return;
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        await media.ensurePhotoBucket(minioConfig);
        const { key } = await media.putDraftPhoto({
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
    mapWizardPhotoError(res, error);
  }
}

export async function handleGetWizardPhotoUrl(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    const media = resolveWizardMediaBinding(workspaceType);
    if (media === undefined) {
      sendHttpError(res, 403, {
        error: "forbidden",
        code: "WIZARD_PHOTO_READ_FORBIDDEN",
      });
      return;
    }

    const minioConfig = media.readPhotoConfigFromEnv();
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

    const readKeyAllowed =
      "isOperatorReadKeyAllowed" in media && typeof media.isOperatorReadKeyAllowed === "function"
        ? media.isOperatorReadKeyAllowed(auth.tenantId, storageKey)
        : media.isDraftReadKeyAllowed(auth.tenantId, storageKey);
    if (!readKeyAllowed) {
      sendHttpError(res, 403, { error: "forbidden", code: "WIZARD_PHOTO_KEY_FORBIDDEN" });
      return;
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const signedUrl = await media.getSignedReadUrl({
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
    mapWizardPhotoError(res, error);
  }
}
