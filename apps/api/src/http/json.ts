import type { IncomingMessage, ServerResponse } from "node:http";

import { assertResponsePayloadWithinBudget } from "./http-response-size-budget";
import { RequestBodyTooLargeError, resolveHttpMaxBodyBytes } from "./request-body-limit";

export const INVALID_JSON = "INVALID_JSON";

export class MalformedJsonBodyError extends Error {
  readonly code = INVALID_JSON;

  constructor() {
    super(INVALID_JSON);
    this.name = "MalformedJsonBodyError";
  }
}

export function isMalformedJsonBodyError(error: unknown): error is MalformedJsonBodyError {
  return error instanceof MalformedJsonBodyError;
}

/** Parses a UTF-8 request body string; empty → `{}`; syntax errors → {@link MalformedJsonBodyError}. */
export function parseJsonBody(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {};
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new MalformedJsonBodyError();
  }
}

function parseContentLength(req: IncomingMessage): number | undefined {
  const raw = req.headers["content-length"];
  if (raw === undefined) {
    return undefined;
  }
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

export async function readRequestBodyRaw(req: IncomingMessage): Promise<string> {
  const maxBytes = resolveHttpMaxBodyBytes();
  const contentLength = parseContentLength(req);
  if (contentLength !== undefined && contentLength > maxBytes) {
    throw new RequestBodyTooLargeError(maxBytes);
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += buf.length;
    if (totalBytes > maxBytes) {
      throw new RequestBodyTooLargeError(maxBytes);
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const raw = await readRequestBodyRaw(req);
  return parseJsonBody(raw) as T;
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  assertResponsePayloadWithinBudget(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(payload);
}

export function sendNoContent(res: ServerResponse): void {
  res.statusCode = 204;
  res.end();
}
