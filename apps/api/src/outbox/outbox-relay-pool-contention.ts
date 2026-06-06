import { readOutboxRelayPublishConcurrency } from "./outbox-relay-config";

const DEFAULT_POOL_CONNECTION_LIMIT = 10;

/** Parse `connection_limit` from DATABASE_URL — Prisma default ~10 when omitted (OB-COND-02). */
export function readDbPoolConnectionLimitFromEnv(): number {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  const match = /connection_limit=(\d+)/i.exec(url);
  if (match === null) {
    return DEFAULT_POOL_CONNECTION_LIMIT;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_POOL_CONNECTION_LIMIT;
  }
  return parsed;
}

export function readOutboxRelayPublishConcurrencyConfig(): number {
  return readOutboxRelayPublishConcurrency();
}

/** Negative when publish concurrency exceeds configured pool limit (OB-COND-02). */
export function readOutboxRelayPoolHeadroom(): number {
  return readDbPoolConnectionLimitFromEnv() - readOutboxRelayPublishConcurrencyConfig();
}
