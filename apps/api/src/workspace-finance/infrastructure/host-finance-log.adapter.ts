/**
 * Host adapter — structured finance logger via platform pino sink.
 */

import { logger } from "../../observability/logger";
import type { FinanceLoggerPort } from "../ports/finance-log.port";

function asLogObject(payload: unknown): Record<string, unknown> {
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return { message: typeof payload === "string" ? payload : JSON.stringify(payload) };
}

export class HostFinanceLogAdapter implements FinanceLoggerPort {
  warn(payload: unknown): void {
    logger.warn({ event: "finance.host.warn", finance: asLogObject(payload) });
  }

  error(payload: unknown): void {
    logger.error({ event: "finance.host.error", finance: asLogObject(payload) });
  }
}
