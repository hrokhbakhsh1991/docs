import type { IncomingMessage, ServerResponse } from "node:http";

import { parseOperationalRosterListQuery } from "@app-tour/workspace-denali/roster";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import { listTourOperationalRoster } from "./operational-roster.service.ts";

export async function handleGetTourOperationalRoster(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseOperationalRosterListQuery(url);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await listTourOperationalRoster(auth, tourId, query);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
