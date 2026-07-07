import type { IncomingMessage } from "node:http";

import { jwtVerify } from "jose";

import { isJwtVerifyConfigured, readJwtVerifyConfig } from "../tenant-kernel/jwt-env";
import { loadPublicKey } from "../tenant-kernel/jwt-key.util";
import { ImpersonationReadOnlyError } from "./impersonation-read-only.error";
import { readSessionCookieToken } from "./parse-session-cookie";

function readBearerToken(req: IncomingMessage): string | null {
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return null;
  }
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function resolveSessionToken(req: IncomingMessage): string | null {
  return readBearerToken(req) ?? readSessionCookieToken(req);
}

export async function assertOperatorImpersonationReadonly(req: IncomingMessage): Promise<void> {
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return;
  }

  const token = resolveSessionToken(req);
  if (token === null) {
    return;
  }

  if (!isJwtVerifyConfigured()) {
    return;
  }

  const config = readJwtVerifyConfig()!;
  const key = await loadPublicKey(config.publicKeyPem);
  const verified = await jwtVerify(token, key, {
    algorithms: ["RS256"],
    issuer: config.issuer,
    audience: config.audience,
    clockTolerance: "5s",
  });

  if (verified.payload.platform_impersonation_readonly === true) {
    throw new ImpersonationReadOnlyError();
  }
}
