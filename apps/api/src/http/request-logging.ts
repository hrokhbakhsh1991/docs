import type { IncomingMessage, ServerResponse } from "node:http";

import { logger, logHttpRequest, type RequestLogContext } from "../observability/logger";
import { normalizeHttpLogPath } from "../observability/log-safety";
import { getActiveTraceId } from "../observability/trace-request-context";
import {
  decrementHttpRequestsInFlight,
  incrementHttpRequestsInFlight,
} from "./http-inflight-metrics";

const HTTP_LOG_QUEUE_MAX = Math.max(
  32,
  Number.parseInt(process.env.HTTP_LOG_QUEUE_MAX ?? "2048", 10) || 2048
);

const queue: RequestLogContext[] = [];
let scheduled = false;
let droppedSinceLastFlush = 0;

function flushQueue(): void {
  scheduled = false;

  if (droppedSinceLastFlush > 0) {
    logger.warn(
      {
        event: "http.log_queue_drop",
        dropped: droppedSinceLastFlush,
        queueMax: HTTP_LOG_QUEUE_MAX,
      },
      "http request log queue overflow"
    );
    droppedSinceLastFlush = 0;
  }

  while (queue.length > 0) {
    const next = queue.shift();
    if (next === undefined) {
      break;
    }
    logHttpRequest(next);
  }
}

function scheduleFlush(): void {
  if (scheduled) {
    return;
  }
  scheduled = true;
  setImmediate(flushQueue);
}

export function enqueueHttpRequestLog(ctx: RequestLogContext): void {
  if (queue.length >= HTTP_LOG_QUEUE_MAX) {
    droppedSinceLastFlush += 1;
    scheduleFlush();
    return;
  }
  queue.push(ctx);
  scheduleFlush();
}

export function __getHttpRequestLogQueueSizeForTests(): number {
  return queue.length;
}

export function __resetHttpRequestLogQueueForTests(): void {
  queue.length = 0;
  scheduled = false;
  droppedSinceLastFlush = 0;
}

/** Shutdown drain — synchronous flush of pending access logs (DEC-063). */
export function drainHttpRequestLogQueueSync(): void {
  scheduled = false;
  if (droppedSinceLastFlush > 0) {
    logger.warn(
      {
        event: "http.log_queue_drop",
        dropped: droppedSinceLastFlush,
        queueMax: HTTP_LOG_QUEUE_MAX,
      },
      "http request log queue overflow"
    );
    droppedSinceLastFlush = 0;
  }
  while (queue.length > 0) {
    const next = queue.shift();
    if (next === undefined) {
      break;
    }
    logHttpRequest(next);
  }
}

export function withRequestLogging(
  listener: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const started = performance.now();
    const method = req.method ?? "GET";
    const path = normalizeHttpLogPath(req.url ?? "/");
    incrementHttpRequestsInFlight();
    let inflightReleased = false;
    const releaseInflight = (): void => {
      if (inflightReleased) {
        return;
      }
      inflightReleased = true;
      decrementHttpRequestsInFlight();
    };

    res.on("finish", () => {
      releaseInflight();
      enqueueHttpRequestLog({
        method,
        path,
        statusCode: res.statusCode,
        durationMs: Math.round(performance.now() - started),
        correlationId: getActiveTraceId(),
      });
    });
    res.on("close", releaseInflight);

    try {
      await listener(req, res);
    } catch (error) {
      releaseInflight();
      throw error;
    }
  };
}
