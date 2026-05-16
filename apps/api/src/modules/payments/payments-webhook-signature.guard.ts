import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "../../config/config.service";
import {
  verifyPaymentWebhookRequest,
  type RequestWithRawBody,
  type WebhookReplayCache
} from "./gateway/webhook-signature.verify";

const replayMap = new Map<string, number>();

const replayCacheAdapter: WebhookReplayCache = {
  get: (k: string) => replayMap.get(k),
  set: (k: string, seenAtMs: number) => replayMap.set(k, seenAtMs),
  deleteExpired(nowMs: number, ttlMs: number) {
    for (const [key, seenAt] of replayMap.entries()) {
      if (nowMs - seenAt > ttlMs) {
        replayMap.delete(key);
      }
    }
  }
};

export type { RequestWithRawBody } from "./gateway/webhook-signature.verify";

@Injectable()
export class PaymentWebhookSignatureGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithRawBody>();
    const nowMs = Date.now();
    verifyPaymentWebhookRequest(
      req,
      {
        allowedIps: this.configService.getPaymentsWebhookAllowedIps(),
        trustedProxyCidrs: this.configService.getTrustedProxyCidrs(),
        secrets: {
          primarySecret: this.configService.getPaymentsWebhookSigningSecret(),
          previousSecret: this.configService.getPaymentsWebhookSigningSecretPrevious()
        },
        nowMs,
        nowSec: Math.floor(nowMs / 1000)
      },
      replayCacheAdapter
    );
    return true;
  }
}
