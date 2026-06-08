import type { IncomingMessage } from "node:http";

import { readJsonBody } from "../http/json";

export async function readUrbanRegistrationRequestBody(
  req: IncomingMessage
): Promise<unknown> {
  return readJsonBody(req);
}
