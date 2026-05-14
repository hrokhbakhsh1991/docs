import { createHash } from "node:crypto";
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  OnModuleDestroy
} from "@nestjs/common";
import type Redis from "ioredis";
import type { IdempotencyKeyStore, IdempotentRunResult, PaymentIdempotencyScope } from "./payment-idempotency-key.store";
import {
  PAYMENTS_GATEWAY_IDEMPOTENCY_REDIS,
  paymentGatewayIdempotencyCompositeKey
} from "./payment-idempotency-key.store";

const PENDING_SENTINEL = "__payment_gateway_idempotency_pending__";
const REDIS_KEY_PREFIX = "paygw:idemp:v1:";

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function redisKey(scope: PaymentIdempotencyScope): string {
  const digest = createHash("sha256")
    .update(paymentGatewayIdempotencyCompositeKey(scope))
    .digest("hex");
  return `${REDIS_KEY_PREFIX}${digest}`;
}

/**
 * Redis-backed {@link IdempotencyKeyStore} for payment gateways (multi-instance safe).
 * Uses `SET … NX` + a pending sentinel so concurrent callers wait for the winner’s result.
 */
@Injectable()
export class RedisPaymentIdempotencyKeyStore implements IdempotencyKeyStore, OnModuleDestroy {
  private readonly pendingTtlSec = 90;
  private readonly resultTtlSec = 86400 * 7;
  private readonly waitDeadlineMs = 35_000;

  constructor(
    @Inject(PAYMENTS_GATEWAY_IDEMPOTENCY_REDIS) private readonly redis: Redis
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async runOnce<T>(
    scope: PaymentIdempotencyScope,
    fn: () => Promise<T>
  ): Promise<IdempotentRunResult<T>> {
    const key = redisKey(scope);
    const deadline = Date.now() + this.waitDeadlineMs;

    while (Date.now() < deadline) {
      const raw = await this.redis.get(key);
      if (raw && raw !== PENDING_SENTINEL) {
        return { value: jsonClone(JSON.parse(raw) as T), replayed: true };
      }
      if (raw === PENDING_SENTINEL) {
        await this.sleepWhilePending(key, deadline);
        continue;
      }

      const acquired = await this.redis.set(key, PENDING_SENTINEL, "EX", this.pendingTtlSec, "NX");
      if (acquired === "OK") {
        try {
          const value = await fn();
          const frozen = jsonClone(value);
          await this.redis.set(key, JSON.stringify(frozen), "EX", this.resultTtlSec);
          return { value: jsonClone(frozen) as T, replayed: false };
        } catch (error: unknown) {
          await this.redis.del(key);
          throw error;
        }
      }

      await this.sleepWhilePending(key, deadline);
    }

    throw new InternalServerErrorException({
      error: {
        code: "PAYMENT_IDEMPOTENCY_LOCK_TIMEOUT",
        message: "Timed out waiting for payment gateway idempotency lock"
      }
    });
  }

  private async sleepWhilePending(key: string, deadline: number): Promise<void> {
    let delayMs = 12;
    while (Date.now() < deadline) {
      const raw = await this.redis.get(key);
      if (raw === null || raw !== PENDING_SENTINEL) {
        return;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, 220);
    }
  }
}
