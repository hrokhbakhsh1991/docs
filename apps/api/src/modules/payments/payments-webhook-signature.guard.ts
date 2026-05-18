import { CanActivate, ExecutionContext, Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "../../config/config.service";
import { REDIS_CLIENT } from "../../infra/redis/redis.constants";
import type { Redis } from "ioredis";
import { InMemoryWebhookReplayCache } from "./gateway/in-memory-webhook-replay.cache";
import { RedisWebhookReplayCache } from "./gateway/redis-webhook-replay.cache";
import {
  verifyPaymentWebhookRequest,
  verifyPaymentWebhookRequestWithoutReplay,
  type RequestWithRawBody
} from "./gateway/webhook-signature.verify";

@Injectable()
export class PaymentWebhookSignatureGuard implements CanActivate {
  private readonly memoryReplay = new InMemoryWebhookReplayCache();
  private readonly redisReplay: RedisWebhookReplayCache | null;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Optional() @Inject(REDIS_CLIENT) redis: Redis | null
  ) {
    this.redisReplay = redis ? new RedisWebhookReplayCache(redis) : null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithRawBody>();
    const nowMs = Date.now();
    const opts = {
      allowedIps: this.configService.getPaymentsWebhookAllowedIps(),
      trustedProxyCidrs: this.configService.getTrustedProxyCidrs(),
      secrets: {
        primarySecret: this.configService.getPaymentsWebhookSigningSecret(),
        previousSecret: this.configService.getPaymentsWebhookSigningSecretPrevious()
      },
      nowMs,
      nowSec: Math.floor(nowMs / 1000)
    };

    const useRedisReplay =
      this.redisReplay !== null && this.configService.getNodeEnv() !== "test";

    if (useRedisReplay) {
      const { timestampNorm, signatureHex } = verifyPaymentWebhookRequestWithoutReplay(req, opts);
      await this.redisReplay!.assertNotReplayed(timestampNorm, signatureHex, nowMs);
      return true;
    }

    verifyPaymentWebhookRequest(req, opts, this.memoryReplay);
    return true;
  }
}
