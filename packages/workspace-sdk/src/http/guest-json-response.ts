import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Neutral guest/workspace HTTP JSON helpers (DG-1 P-lib).
 * Workspace handlers keep `handlerPackage` ownership; they call these instead of
 * copy-pasting send/parse boilerplate.
 */

export function sendWorkspaceJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function sendWorkspaceNotFound(res: ServerResponse): void {
  sendWorkspaceJson(res, 404, {
    success: false,
    error: "not_found",
    code: "NOT_FOUND",
  });
}

export function sendWorkspaceGuestStub(
  res: ServerResponse,
  code: string = "WORKSPACE_GUEST_STUB",
): void {
  sendWorkspaceJson(res, 501, { success: false, code });
}

/** Host-style 404 body used by workspace product routes via `sendHttpError` (DG-1.9). */
export const WORKSPACE_HTTP_ERROR_NOT_FOUND = Object.freeze({
  error: "not_found",
  code: "NOT_FOUND",
} as const);

/** `{ success: true, data }` envelope for detail/create handlers (DG-1.9). */
export function buildWorkspaceSuccessDataBody<T>(data: T): {
  readonly success: true;
  readonly data: T;
} {
  return { success: true, data };
}

export function readWorkspaceJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (text.trim().length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}
