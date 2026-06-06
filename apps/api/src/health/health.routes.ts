import type { IncomingMessage, ServerResponse } from "node:http";
import { performance } from "node:perf_hooks";

import { sendJson } from "../http/json";
import { recordHealthProbeDuration } from "./health-probe-latency";
import { isGracefulShutdownInProgress } from "../server/graceful-shutdown";

export function handleHealth(_req: IncomingMessage, res: ServerResponse): void {
  const started = performance.now();
  res.once("finish", () => {
    recordHealthProbeDuration(performance.now() - started);
  });

  if (isGracefulShutdownInProgress()) {
    sendJson(res, 503, {
      status: "shutting_down",
      service: "@apps/api",
    });
    return;
  }
  sendJson(res, 200, { status: "ok", service: "@apps/api" });
}
