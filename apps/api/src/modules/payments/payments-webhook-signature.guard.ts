import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { ConfigService } from "../../config/config.service";
import { resolveThrottleClientIp } from "../../common/throttling/public-registration-throttle";

const TIMESTAMP_HEADER = "x-payments-webhook-timestamp";
const SIGNATURE_HEADER = "x-payments-webhook-signature";
const MAX_SKEW_SEC = 300;
const REPLAY_TTL_MS = (MAX_SKEW_SEC + 60) * 1000;
const replayCache = new Map<string, number>();

export type RequestWithRawBody = Request & { rawBody?: Buffer };

@Injectable()
export class PaymentWebhookSignatureGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    this.evictExpiredReplayEntries(Date.now());
    const req = context.switchToHttp().getRequest<RequestWithRawBody>();
    const allowedIps = this.configService.getPaymentsWebhookAllowedIps();
    if (allowedIps.length > 0) {
      const ip = resolveThrottleClientIp(req as unknown as Record<string, unknown>, {
        trustedProxyCidrs: this.configService.getTrustedProxyCidrs()
      });
      if (!allowedIps.includes(ip)) {
        throw new ForbiddenException({
          error: {
            code: "WEBHOOK_IP_NOT_ALLOWED",
            message: "Caller IP is not allowlisted for payment webhooks"
          }
        });
      }
    }

    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw)) {
      throw new UnauthorizedException({
        error: {
          code: "WEBHOOK_SIGNATURE_INVALID",
          message: "Signed webhook body required"
        }
      });
    }

    const tsHeader = req.header(TIMESTAMP_HEADER) ?? req.header(TIMESTAMP_HEADER.toUpperCase());
    const sigHeader = req.header(SIGNATURE_HEADER) ?? req.header(SIGNATURE_HEADER.toUpperCase());
    if (!tsHeader?.trim() || !sigHeader?.trim()) {
      throw new UnauthorizedException({
        error: {
          code: "WEBHOOK_SIGNATURE_INVALID",
          message: "Missing webhook timestamp or signature headers"
        }
      });
    }

    const tsNorm = tsHeader.trim();
    const ts = Number(tsNorm);
    if (!Number.isFinite(ts) || ts <= 0) {
      throw new UnauthorizedException({
        error: {
          code: "WEBHOOK_TIMESTAMP_INVALID",
          message: "Invalid webhook timestamp"
        }
      });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - ts) > MAX_SKEW_SEC) {
      throw new UnauthorizedException({
        error: {
          code: "WEBHOOK_TIMESTAMP_EXPIRED",
          message: "Webhook timestamp outside allowed window"
        }
      });
    }

    const primary = this.configService.getPaymentsWebhookSigningSecret();
    const previous = this.configService.getPaymentsWebhookSigningSecretPrevious();
    const signedMaterial = Buffer.concat([Buffer.from(`${tsNorm}.`, "utf8"), raw]);
    const expectedHex = (secret: string) =>
      createHmac("sha256", secret).update(signedMaterial).digest("hex");
    const expectedPrimary = expectedHex(primary);
    const candidates =
      previous.length >= 16 ? [expectedPrimary, expectedHex(previous)] : [expectedPrimary];

    const provided = sigHeader.trim().toLowerCase().replace(/^v1=/, "");
    const hexBuf = (hex: string): Buffer | null => {
      if (!/^[0-9a-f]{64}$/i.test(hex)) {
        return null;
      }
      return Buffer.from(hex, "hex");
    };
    const providedBuf = hexBuf(provided);
    if (!providedBuf) {
      throw new UnauthorizedException({
        error: {
          code: "WEBHOOK_SIGNATURE_INVALID",
          message: "Invalid webhook signature format"
        }
      });
    }
    const ok = candidates.some((hex) => {
      const h = hexBuf(hex);
      return h !== null && h.length === providedBuf.length && timingSafeEqual(h, providedBuf);
    });

    if (!ok) {
      throw new UnauthorizedException({
        error: {
          code: "WEBHOOK_SIGNATURE_INVALID",
          message: "Invalid webhook signature"
        }
      });
    }

    const replayKey = `${tsNorm}:${provided}`;
    const nowMs = Date.now();
    const seenAt = replayCache.get(replayKey);
    if (typeof seenAt === "number" && nowMs - seenAt <= REPLAY_TTL_MS) {
      throw new UnauthorizedException({
        error: {
          code: "WEBHOOK_REPLAY_DETECTED",
          message: "Replay webhook detected"
        }
      });
    }
    replayCache.set(replayKey, nowMs);

    return true;
  }

  private evictExpiredReplayEntries(nowMs: number): void {
    for (const [key, seenAt] of replayCache.entries()) {
      if (nowMs - seenAt > REPLAY_TTL_MS) {
        replayCache.delete(key);
      }
    }
  }
}
