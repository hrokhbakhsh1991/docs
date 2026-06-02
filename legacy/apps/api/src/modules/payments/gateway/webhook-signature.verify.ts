import { createHmac, timingSafeEqual } from "node:crypto";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { resolveThrottleClientIp } from "../../../common/throttling/public-registration-throttle";

export const PAYMENTS_WEBHOOK_TIMESTAMP_HEADER = "x-payments-webhook-timestamp";
export const PAYMENTS_WEBHOOK_SIGNATURE_HEADER = "x-payments-webhook-signature";
export const PAYMENTS_WEBHOOK_MAX_SKEW_SEC = 300;
export const PAYMENTS_WEBHOOK_REPLAY_TTL_MS = (PAYMENTS_WEBHOOK_MAX_SKEW_SEC + 60) * 1000;

export type RequestWithRawBody = Request & { rawBody?: Buffer };

export type PaymentWebhookVerifySecrets = {
  primarySecret: string;
  previousSecret: string;
};

export type PaymentWebhookVerifyOptions = {
  allowedIps: string[];
  trustedProxyCidrs: string[];
  secrets: PaymentWebhookVerifySecrets;
  nowMs: number;
  nowSec: number;
};

/** HMAC verification only (timestamp freshness must be checked separately). */
export function assertPaymentWebhookHmacValid(
  rawBody: Buffer,
  timestampHeader: string,
  signatureHeader: string,
  secrets: PaymentWebhookVerifySecrets
): void {
  const tsNorm = timestampHeader.trim();

  const signedMaterial = Buffer.concat([Buffer.from(`${tsNorm}.`, "utf8"), rawBody]);
  const expectedHex = (secret: string) =>
    createHmac("sha256", secret).update(signedMaterial).digest("hex");
  const expectedPrimary = expectedHex(secrets.primarySecret);
  const candidates =
    secrets.previousSecret.length >= 16
      ? [expectedPrimary, expectedHex(secrets.previousSecret)]
      : [expectedPrimary];

  const provided = signatureHeader.trim().toLowerCase().replace(/^v1=/, "");
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
}

export function assertPaymentWebhookTimestampFresh(
  timestampHeader: string,
  nowSec: number,
  maxSkewSec: number
): void {
  const tsNorm = timestampHeader.trim();
  const ts = Number(tsNorm);
  if (!Number.isFinite(ts) || ts <= 0) {
    throw new UnauthorizedException({
      error: {
        code: "WEBHOOK_TIMESTAMP_INVALID",
        message: "Invalid webhook timestamp"
      }
    });
  }
  if (Math.abs(nowSec - ts) > maxSkewSec) {
    throw new UnauthorizedException({
      error: {
        code: "WEBHOOK_TIMESTAMP_EXPIRED",
        message: "Webhook timestamp outside allowed window"
      }
    });
  }
}

export function assertPaymentWebhookIpAllowed(
  req: Request,
  allowedIps: string[],
  trustedProxyCidrs: string[]
): void {
  if (allowedIps.length === 0) {
    return;
  }
  const ip = resolveThrottleClientIp(req as unknown as Record<string, unknown>, {
    trustedProxyCidrs
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

export function assertPaymentWebhookRawBodyPresent(raw: Buffer | undefined): asserts raw is Buffer {
  if (!raw || !Buffer.isBuffer(raw)) {
    throw new UnauthorizedException({
      error: {
        code: "WEBHOOK_SIGNATURE_INVALID",
        message: "Signed webhook body required"
      }
    });
  }
}

export type WebhookReplayCache = {
  get(_key: string): number | undefined;
  set(_key: string, _seenAtMs: number): void;
  deleteExpired(_nowMs: number, _ttlMs: number): void;
};

export function assertPaymentWebhookNotReplayed(
  replayCache: WebhookReplayCache,
  timestampNorm: string,
  signatureHex: string,
  nowMs: number,
  ttlMs: number
): void {
  replayCache.deleteExpired(nowMs, ttlMs);
  const replayKey = `${timestampNorm}:${signatureHex}`;
  const seenAt = replayCache.get(replayKey);
  if (typeof seenAt === "number" && nowMs - seenAt <= ttlMs) {
    throw new UnauthorizedException({
      error: {
        code: "WEBHOOK_REPLAY_DETECTED",
        message: "Replay webhook detected"
      }
    });
  }
  replayCache.set(replayKey, nowMs);
}

/**
 * Full verification pipeline used by {@link PaymentWebhookSignatureGuard}.
 */
export function verifyPaymentWebhookRequest(
  req: RequestWithRawBody,
  opts: PaymentWebhookVerifyOptions,
  replayCache: WebhookReplayCache
): void {
  assertPaymentWebhookIpAllowed(req, opts.allowedIps, opts.trustedProxyCidrs);
  assertPaymentWebhookRawBodyPresent(req.rawBody);

  const tsHeader =
    req.header(PAYMENTS_WEBHOOK_TIMESTAMP_HEADER) ??
    req.header(PAYMENTS_WEBHOOK_TIMESTAMP_HEADER.toUpperCase());
  const sigHeader =
    req.header(PAYMENTS_WEBHOOK_SIGNATURE_HEADER) ??
    req.header(PAYMENTS_WEBHOOK_SIGNATURE_HEADER.toUpperCase());
  if (!tsHeader?.trim() || !sigHeader?.trim()) {
    throw new UnauthorizedException({
      error: {
        code: "WEBHOOK_SIGNATURE_INVALID",
        message: "Missing webhook timestamp or signature headers"
      }
    });
  }

  assertPaymentWebhookTimestampFresh(tsHeader, opts.nowSec, PAYMENTS_WEBHOOK_MAX_SKEW_SEC);
  assertPaymentWebhookHmacValid(req.rawBody, tsHeader, sigHeader, opts.secrets);

  const provided = sigHeader.trim().toLowerCase().replace(/^v1=/, "");
  assertPaymentWebhookNotReplayed(
    replayCache,
    tsHeader.trim(),
    provided,
    opts.nowMs,
    PAYMENTS_WEBHOOK_REPLAY_TTL_MS
  );
}

/** HMAC + IP checks without replay dedupe (caller handles replay via Redis or memory). */
export function verifyPaymentWebhookRequestWithoutReplay(
  req: RequestWithRawBody,
  opts: PaymentWebhookVerifyOptions
): { timestampNorm: string; signatureHex: string } {
  assertPaymentWebhookIpAllowed(req, opts.allowedIps, opts.trustedProxyCidrs);
  assertPaymentWebhookRawBodyPresent(req.rawBody);

  const tsHeader =
    req.header(PAYMENTS_WEBHOOK_TIMESTAMP_HEADER) ??
    req.header(PAYMENTS_WEBHOOK_TIMESTAMP_HEADER.toUpperCase());
  const sigHeader =
    req.header(PAYMENTS_WEBHOOK_SIGNATURE_HEADER) ??
    req.header(PAYMENTS_WEBHOOK_SIGNATURE_HEADER.toUpperCase());
  if (!tsHeader?.trim() || !sigHeader?.trim()) {
    throw new UnauthorizedException({
      error: {
        code: "WEBHOOK_SIGNATURE_INVALID",
        message: "Missing webhook timestamp or signature headers"
      }
    });
  }

  assertPaymentWebhookTimestampFresh(tsHeader, opts.nowSec, PAYMENTS_WEBHOOK_MAX_SKEW_SEC);
  assertPaymentWebhookHmacValid(req.rawBody, tsHeader, sigHeader, opts.secrets);

  const provided = sigHeader.trim().toLowerCase().replace(/^v1=/, "");
  return { timestampNorm: tsHeader.trim(), signatureHex: provided };
}
