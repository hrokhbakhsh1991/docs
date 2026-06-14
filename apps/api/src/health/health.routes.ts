import type { IncomingMessage, ServerResponse } from "node:http";
import { performance } from "node:perf_hooks";

import { sendJson } from "../http/json";
import { probeDatabaseHealth } from "../db/database-health";
import { recordHealthProbeDuration } from "./health-probe-latency";
import { isGracefulShutdownInProgress } from "../server/graceful-shutdown";

export async function handleHealth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
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

  const database = await probeDatabaseHealth();
  if (database?.status === "fail") {
    sendJson(res, 503, {
      status: "degraded",
      service: "@apps/api",
      checks: { database },
    });
    return;
  }

  sendJson(res, 200, {
    status: "ok",
    service: "@apps/api",
    ...(database !== null ? { checks: { database } } : {}),
  });
}
