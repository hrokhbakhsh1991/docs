import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError } from "../middleware/error-interceptor";
import { getMemberEntitlements } from "./me.entitlements.service";
import { requireOperatorSession } from "./require-operator-session";

export async function handleGetIdentityMeEntitlements(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const payload = await getMemberEntitlements(auth);
        sendJson(res, 200, payload);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
