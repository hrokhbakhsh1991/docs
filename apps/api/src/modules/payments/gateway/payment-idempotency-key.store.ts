import { Injectable } from "@nestjs/common";

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
  runOnce<T>(scope: PaymentIdempotencyScope, fn: () => Promise<T>): Promise<IdempotentRunResult<T>>;
}

/** Nest DI token for {@link IdempotencyKeyStore} (memory vs Redis implementation). */
export const PAYMENT_GATEWAY_IDEMPOTENCY_STORE = Symbol("PAYMENT_GATEWAY_IDEMPOTENCY_STORE");

/** Dedicated Redis client for payment-gateway idempotency (avoid coupling to tenant-abuse Redis). */
export const PAYMENTS_GATEWAY_IDEMPOTENCY_REDIS = Symbol("PAYMENTS_GATEWAY_IDEMPOTENCY_REDIS");

export function paymentGatewayIdempotencyCompositeKey(scope: PaymentIdempotencyScope): string {
  return `${scope.tenantId}\n${scope.operation}\n${scope.idempotencyKey}`;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compositeKey(scope: PaymentIdempotencyScope): string {
  return paymentGatewayIdempotencyCompositeKey(scope);
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
          return { value: jsonClone(hit) as T, replayed: true as const };
        }
        const value = await fn();
        const frozen = jsonClone(value);
        this.cache.set(key, frozen);
        return { value: jsonClone(frozen) as T, replayed: false as const };
      }) as Promise<IdempotentRunResult<T>>;

    this.chainTail.set(key, next);
    return next;
  }
}
