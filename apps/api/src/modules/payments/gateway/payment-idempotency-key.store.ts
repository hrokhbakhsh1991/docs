import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  unwrapIdempotencyCacheValue,
  wrapIdempotencyCacheValue,
} from "./idempotency-cache-envelope";

export type PaymentIdempotencyScope = {
  tenantId: string;
  /** Logical operation, e.g. `stripe:create_payment_intent`. */
  operation: string;
  idempotencyKey: string;
};

export type IdempotentRunResult<T> = {
  value: T;
  /** True when a prior completed or in-flight execution satisfied this call. */
  replayed: boolean;
};

/**
 * Payment-layer idempotency (distinct from HTTP `IdempotencyService` on routes).
 * Same composite key must yield the same successful result; failures are not cached.
 */
export interface IdempotencyKeyStore {
  runOnce<T>(_scope: PaymentIdempotencyScope, _fn: () => Promise<T>): Promise<IdempotentRunResult<T>>;
}

/** Nest DI token for {@link IdempotencyKeyStore} (memory vs Redis implementation). */
export const PAYMENT_GATEWAY_IDEMPOTENCY_STORE = Symbol("PAYMENT_GATEWAY_IDEMPOTENCY_STORE");

/** Dedicated Redis client for payment-gateway idempotency (avoid coupling to tenant-abuse Redis). */
export const PAYMENTS_GATEWAY_IDEMPOTENCY_REDIS = Symbol("PAYMENTS_GATEWAY_IDEMPOTENCY_REDIS");

export function paymentGatewayIdempotencyCompositeKey(scope: PaymentIdempotencyScope): string {
  return `${scope.tenantId}\n${scope.operation}\n${scope.idempotencyKey}`;
}

/** SHA-256 digest binding tenant + operation + client idempotency key (Redis/Postgres namespace isolation). */
export function paymentGatewayIdempotencyDigest(scope: PaymentIdempotencyScope): string {
  const tenantId = scope.tenantId.trim();
  const operation = scope.operation.trim();
  const idempotencyKey = scope.idempotencyKey.trim();
  return createHash("sha256").update(`${tenantId}:${operation}:${idempotencyKey}`).digest("hex");
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compositeKey(scope: PaymentIdempotencyScope): string {
  return paymentGatewayIdempotencyDigest(scope);
}

/**
 * In-process {@link IdempotencyKeyStore} (single Node instance). **Not** cross-replica or crash-safe.
 * Use {@link PostgresPaymentIdempotencyKeyStore} (default outside tests) or {@link RedisPaymentIdempotencyKeyStore}.
 */
@Injectable()
export class InMemoryIdempotencyKeyStore implements IdempotencyKeyStore {
  private readonly cache = new Map<string, unknown>();
  private readonly chainTail = new Map<string, Promise<unknown>>();

  async runOnce<T>(scope: PaymentIdempotencyScope, fn: () => Promise<T>): Promise<IdempotentRunResult<T>> {
    const key = compositeKey(scope);
    const prev = this.chainTail.get(key) ?? Promise.resolve();

    const next = (prev as Promise<unknown>)
      .catch(() => {
        /* keep chain alive after a failed attempt */
      })
      .then(async () => {
        const hit = this.cache.get(key);
        if (hit !== undefined) {
          const value = unwrapIdempotencyCacheValue<T>(scope.tenantId, hit);
          return { value: jsonClone(value) as T, replayed: true as const };
        }
        const value = await fn();
        const frozen = jsonClone(value);
        this.cache.set(key, wrapIdempotencyCacheValue(scope.tenantId, frozen));
        return { value: jsonClone(frozen) as T, replayed: false as const };
      }) as Promise<IdempotentRunResult<T>>;

    this.chainTail.set(key, next);
    return next;
  }
}
