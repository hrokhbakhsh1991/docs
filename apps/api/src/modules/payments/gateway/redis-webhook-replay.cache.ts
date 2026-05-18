import { UnauthorizedException } from "@nestjs/common";
import type { Redis } from "ioredis";
import { PAYMENTS_WEBHOOK_REPLAY_TTL_MS } from "./webhook-signature.verify";

const KEY_PREFIX = "payments:webhook:replay:";

/**
 * Cross-instance webhook replay protection (SET NX + TTL).
 * Used by {@link PaymentWebhookSignatureGuard} when Redis is available.
 */
export class RedisWebhookReplayCache {
  constructor(private readonly redis: Redis) {}

  async assertNotReplayed(timestampNorm: string, signatureHex: string, nowMs: number): Promise<void> {
    const replayKey = `${KEY_PREFIX}${timestampNorm}:${signatureHex}`;
    const ttlSec = Math.ceil(PAYMENTS_WEBHOOK_REPLAY_TTL_MS / 1000);
    const inserted = await this.redis.set(replayKey, String(nowMs), "EX", ttlSec, "NX");
    if (inserted !== "OK") {
      throw new UnauthorizedException({
        error: {
          code: "WEBHOOK_REPLAY_DETECTED",
          message: "Replay webhook detected"
        }
      });
    }
  }
}
