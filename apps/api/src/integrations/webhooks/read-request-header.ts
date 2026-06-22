import type { IncomingMessage } from "node:http";

export function readRequestHeader(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (raw === undefined) {
    return undefined;
  }
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
