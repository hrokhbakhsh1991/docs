import type { IncomingMessage, ServerResponse } from "node:http";

import { logHttpRequest } from "../observability/logger";

export function withRequestLogging(
  listener: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const started = performance.now();
    const method = req.method ?? "GET";
    const path = req.url ?? "/";

    res.on("finish", () => {
      logHttpRequest({
        method,
        path,
        statusCode: res.statusCode,
        durationMs: Math.round(performance.now() - started),
      });
    });

    await listener(req, res);
  };
}
