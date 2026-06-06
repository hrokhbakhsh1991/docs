import type { IncomingMessage, ServerResponse } from "node:http";

export async function readRequestBodyRaw(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const raw = (await readRequestBodyRaw(req)).trim();
  if (raw.length === 0) {
    return {} as T;
  }
  return JSON.parse(raw) as T;
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(payload);
}
