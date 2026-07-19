export interface FinanceLoggerPort {
  warn(payload: unknown): void;
  error(payload: unknown): void;
}

/** @deprecated Prefer {@link FinanceLoggerPort}. */
export type FinanceLogPort = FinanceLoggerPort;
