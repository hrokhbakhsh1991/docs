import type { IncomingMessage } from "node:http";

import { parseJsonBody, readRequestBodyRaw } from "../http/json";

export type ParsedTourRequestBody = {
  readonly rawBody: string;
  readonly parsedBody: unknown;
};

/** Single read + single syntax parse for POST/PATCH /tours (DEC-100). */
export async function readTourRequestBody(req: IncomingMessage): Promise<ParsedTourRequestBody> {
  const rawBody = await readRequestBodyRaw(req);
  const parsedBody = parseJsonBody(rawBody);
  return { rawBody, parsedBody };
}
