import type { IncomingMessage, ServerResponse } from "node:http";
import { jwtVerify } from "jose";

import { sendJson } from "../http/json";
import { handleHttpError } from "../middleware/error-interceptor";
import { isJwtVerifyConfigured, readJwtVerifyConfig } from "../tenant-kernel/jwt-env";
import { loadPublicKey } from "../tenant-kernel/jwt-key.util";
import { IdentityRequiredError } from "./identity.errors";
import { readIdentityRequestBody } from "./read-identity-request-body";

export async function acceptPlatformImpersonationSession(
  sessionToken: string
): Promise<{ sessionToken: string }> {
  if (!isJwtVerifyConfigured()) {
    throw new IdentityRequiredError();
  }

  const config = readJwtVerifyConfig()!;
  const key = await loadPublicKey(config.publicKeyPem);

  try {
    const verified = await jwtVerify(sessionToken, key, {
      algorithms: ["RS256"],
      issuer: config.issuer,
      audience: config.audience,
      clockTolerance: "5s",
    });
    if (verified.payload.platform_impersonation_readonly !== true) {
      const err = new Error("IMPERSONATION_ACCEPT_FORBIDDEN");
      (err as Error & { status?: number }).status = 403;
      throw err;
    }
    return { sessionToken };
  } catch (error) {
    if (error instanceof Error && error.message === "IMPERSONATION_ACCEPT_FORBIDDEN") {
      throw error;
    }
    throw new IdentityRequiredError();
  }
}

function readSessionTokenField(body: unknown): string {
  if (typeof body !== "object" || body === null) {
    return "";
  }
  const value = (body as Record<string, unknown>).sessionToken;
  return typeof value === "string" ? value.trim() : "";
}

export async function handleAcceptPlatformImpersonation(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await readIdentityRequestBody(req);
    const sessionToken = readSessionTokenField(body);
    if (sessionToken.length === 0) {
      throw new IdentityRequiredError();
    }
    const accepted = await acceptPlatformImpersonationSession(sessionToken);
    sendJson(res, 200, accepted);
  } catch (error) {
    if (error instanceof Error && error.message === "IMPERSONATION_ACCEPT_FORBIDDEN") {
      sendJson(res, 403, { error: "forbidden", code: "IMPERSONATION_ACCEPT_FORBIDDEN" });
      return;
    }
    handleHttpError(res, error);
  }
}
