import type { IncomingMessage } from "node:http";
import type { JWTPayload } from "jose";

const REQUEST_JWT_SESSION_VERSION = Symbol.for("app-cloud.requestJwtSessionVersion");

type IncomingMessageWithJwtSession = IncomingMessage & {
  [REQUEST_JWT_SESSION_VERSION]?: number;
};

/** Parse JWT `sess_ver` (number or decimal string). */
export function parseSessVerClaim(payload: JWTPayload): number | undefined {
  const raw = payload.sess_ver;
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0) {
    return raw;
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return Number(raw.trim());
  }
  return undefined;
}

export function attachRequestJwtSessionVersion(
  req: IncomingMessage,
  sessionVersion: number | undefined
): void {
  const tagged = req as IncomingMessageWithJwtSession;
  if (sessionVersion === undefined) {
    delete tagged[REQUEST_JWT_SESSION_VERSION];
    return;
  }
  tagged[REQUEST_JWT_SESSION_VERSION] = sessionVersion;
}

export function readRequestJwtSessionVersion(req: IncomingMessage): number | undefined {
  return (req as IncomingMessageWithJwtSession)[REQUEST_JWT_SESSION_VERSION];
}
