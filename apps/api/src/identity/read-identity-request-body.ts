import type { IncomingMessage } from "node:http";

import { parseJsonBody, readRequestBodyRaw } from "../http/json";

export async function readIdentityRequestBody(req: IncomingMessage): Promise<unknown> {
  const raw = await readRequestBodyRaw(req);
  return parseJsonBody(raw);
}
