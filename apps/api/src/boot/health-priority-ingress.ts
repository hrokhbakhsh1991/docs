import type { IncomingMessage, ServerResponse } from "node:http";

import { handleHealth } from "../health/health.routes";
import { withRequestLogging } from "../http/request-logging";
import { resolveTraceIdFromHeaders } from "../observability/resolve-trace-id";
import { runWithTraceContext } from "../observability/trace-request-context";

export type HttpRequestListener = (
  req: IncomingMessage,
  res: ServerResponse
) => void | Promise<void>;

/** True for K8s / cold-start probe path only. */
export function isHealthGetRequest(req: IncomingMessage): boolean {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  return (req.method ?? "GET") === "GET" && url.pathname === "/health";
}

function attachRequestLoggingAndTrace(dispatch: HttpRequestListener): HttpRequestListener {
  return withRequestLogging((req, res) => {
    const traceId = resolveTraceIdFromHeaders(req.headers);
    return runWithTraceContext(traceId, async () => {
      await dispatch(req, res);
    });
  });
}

/**
 * NN-08 — serve GET /health before access-log queue, trace ALS, and lazy app import.
 */
export function createHealthAwareServerListener(
  dispatch: HttpRequestListener
): HttpRequestListener {
  const businessListener = attachRequestLoggingAndTrace(dispatch);

  return (req, res) => {
    if (isHealthGetRequest(req)) {
      void handleHealth(req, res);
      return;
    }
    void businessListener(req, res);
  };
}
