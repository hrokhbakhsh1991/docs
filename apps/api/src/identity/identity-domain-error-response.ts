import type { ServerResponse } from "node:http";

import { sendJson } from "../http/json";

/** Pre-login identity routes — stable code only (no raw Error.message in HTTP body). */
export function sendIdentityDomainError(
  res: ServerResponse,
  status: number,
  error: { readonly code: string }
): void {
  sendJson(res, status, { error: error.code, code: error.code });
}
