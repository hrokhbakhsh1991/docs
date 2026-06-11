import type { IncomingMessage } from "node:http";

import { RequestBodyTooLargeError } from "./request-body-limit";

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

/** Reads a raw binary request body with an explicit byte ceiling (photo uploads). */
export async function readBinaryRequestBody(
  req: IncomingMessage,
  maxBytes: number
): Promise<Buffer> {
  const contentLength = parseContentLength(req);
  if (contentLength !== undefined && contentLength > maxBytes) {
    throw new RequestBodyTooLargeError(maxBytes);
  }

  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw new RequestBodyTooLargeError(maxBytes);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}
