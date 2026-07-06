import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { MembershipNotFoundError } from "./in-memory-identity.repository";
import {
  getOperatorProfile,
  patchOperatorProfile,
  ProfileBirthDateInvalidError,
  ProfileDisplayNameInvalidError,
  ProfileEmailInvalidError,
  ProfileFatherNameInvalidError,
  ProfileGenderInvalidError,
  ProfileNationalIdInvalidError,
} from "./me.service";
import type { PatchOperatorProfileRequest } from "./me.types";
import { readIdentityRequestBody } from "./read-identity-request-body";
import { requireOperatorSession } from "./require-operator-session";

function readStringField(body: unknown, key: string): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function readNullableStringField(body: unknown, key: string): string | null | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const value = (body as Record<string, unknown>)[key];
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function parsePatchProfileBody(body: unknown): PatchOperatorProfileRequest {
  const displayName = readStringField(body, "displayName");
  const email = readNullableStringField(body, "email");
  const gender = readNullableStringField(body, "gender");
  const nationalId = readStringField(body, "nationalId");
  const fatherName = readStringField(body, "fatherName");
  const birthDate = readStringField(body, "birthDate");
  return {
    ...(displayName === undefined ? {} : { displayName }),
    ...(email === undefined ? {} : { email }),
    ...(gender === undefined ? {} : { gender }),
    ...(nationalId === undefined ? {} : { nationalId }),
    ...(fatherName === undefined ? {} : { fatherName }),
    ...(birthDate === undefined ? {} : { birthDate }),
  } as PatchOperatorProfileRequest;
}

export async function handleGetIdentityMe(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const profile = await getOperatorProfile(auth);
        sendJson(res, 200, profile);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    if (error instanceof MembershipNotFoundError) {
      sendHttpError(res, 404, { error: "not_found", code: error.code, userId: error.userId });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handlePatchIdentityMe(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const patch = parsePatchProfileBody(body);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const profile = await patchOperatorProfile(auth, patch);
        sendJson(res, 200, profile);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (error instanceof ProfileDisplayNameInvalidError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code });
      return;
    }
    if (error instanceof ProfileGenderInvalidError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code });
      return;
    }
    if (error instanceof ProfileNationalIdInvalidError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code });
      return;
    }
    if (error instanceof ProfileFatherNameInvalidError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code });
      return;
    }
    if (error instanceof ProfileEmailInvalidError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code });
      return;
    }
    if (error instanceof ProfileBirthDateInvalidError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code });
      return;
    }
    if (error instanceof MembershipNotFoundError) {
      sendHttpError(res, 404, { error: "not_found", code: error.code, userId: error.userId });
      return;
    }
    handleHttpError(res, error);
  }
}
