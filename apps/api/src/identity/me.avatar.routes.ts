import type { IncomingMessage, ServerResponse } from "node:http";

import { OPERATOR_AVATAR_MAX_BYTES } from "@app-tour/workspace-sdk";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { readBinaryRequestBody } from "../http/read-binary-body";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { MembershipNotFoundError } from "./in-memory-identity.repository";
import {
  removeOperatorAvatar,
  resolveOperatorAvatarUrl,
  uploadOperatorAvatar,
} from "./operator-avatar.service";
import { assertOperatorAvatarUploadContentType } from "./operator-avatar-storage";
import { requireOperatorSession } from "./require-operator-session";

function readOperatorAvatarInvalidBodyErrorCode(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  const token = message.split(":", 1)[0]?.trim() ?? "";
  if (token.length === 0) {
    return null;
  }
  if (token === "CONTENT_TYPE_REQUIRED" || token.startsWith("OPERATOR_AVATAR_")) {
    return token;
  }
  return null;
}

function mapOperatorAvatarError(res: ServerResponse, error: unknown): void {
  if (error instanceof MembershipNotFoundError) {
    sendHttpError(res, 404, { error: "not_found", code: error.code, userId: error.userId });
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message === "MINIO_NOT_CONFIGURED") {
    sendHttpError(res, 503, { error: "service_unavailable", code: "MINIO_NOT_CONFIGURED" });
    return;
  }
  if (message === "OPERATOR_AVATAR_NOT_SET") {
    sendHttpError(res, 404, { error: "not_found", code: "OPERATOR_AVATAR_NOT_SET" });
    return;
  }
  const invalidBodyCode = readOperatorAvatarInvalidBodyErrorCode(error);
  if (invalidBodyCode !== null) {
    sendHttpError(res, 400, { error: "invalid_body", code: invalidBodyCode });
    return;
  }
  handleHttpError(res, error);
}

export async function handleUploadIdentityMeAvatar(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const contentType = (req.headers["content-type"] ?? "").toString().trim().toLowerCase();
    if (contentType.length === 0) {
      sendHttpError(res, 400, { error: "invalid_body", code: "CONTENT_TYPE_REQUIRED" });
      return;
    }
    assertOperatorAvatarUploadContentType(contentType);
    const body = await readBinaryRequestBody(req, OPERATOR_AVATAR_MAX_BYTES);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const profile = await uploadOperatorAvatar(auth, body, contentType);
        sendJson(res, 201, profile);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    mapOperatorAvatarError(res, error);
  }
}

export async function handleDeleteIdentityMeAvatar(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const profile = await removeOperatorAvatar(auth);
        sendJson(res, 200, profile);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    mapOperatorAvatarError(res, error);
  }
}

export async function handleGetIdentityMeAvatarUrl(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await resolveOperatorAvatarUrl(auth);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    mapOperatorAvatarError(res, error);
  }
}
