import type { IncomingMessage } from "node:http";

import { PaymentsWebhookSourceIpBlockedError } from "./webhook.errors.ts";

function parseAllowedIps(): readonly string[] {
  const raw = process.env.PAYMENTS_WEBHOOK_ALLOWED_IPS?.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function resolveClientIp(req: IncomingMessage): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (raw) {
    const first = raw.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return req.socket.remoteAddress?.trim() || undefined;
}

/**
 * Optional edge guard — no-op when PAYMENTS_WEBHOOK_ALLOWED_IPS is unset.
 */
export function assertPaymentsWebhookSourceIp(req: IncomingMessage): void {
  const allowed = parseAllowedIps();
  if (allowed.length === 0) {
    return;
  }

  const clientIp = resolveClientIp(req);
  if (clientIp === undefined || !allowed.includes(clientIp)) {
    throw new PaymentsWebhookSourceIpBlockedError();
  }
}
