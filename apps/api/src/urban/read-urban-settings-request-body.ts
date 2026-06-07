import type { IncomingMessage } from "node:http";

import { parseJsonBody, readRequestBodyRaw } from "../http/json";

export async function readUrbanSettingsRequestBody(req: IncomingMessage): Promise<unknown> {
  const rawBody = await readRequestBodyRaw(req);
  return parseJsonBody(rawBody);
}
