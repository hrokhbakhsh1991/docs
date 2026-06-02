import { createHmac } from "node:crypto";

/**
 * HMAC-SHA256 hex over `${timestamp}.${rawBody}` (must match server raw JSON bytes).
 */
export function signPaymentsWebhookPayload(
  rawBodyUtf8: string,
  secret: string
): { timestamp: string; signature: string } {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signed = Buffer.concat([
    Buffer.from(`${timestamp}.`, "utf8"),
    Buffer.from(rawBodyUtf8, "utf8")
  ]);
  const signature = createHmac("sha256", secret).update(signed).digest("hex");
  return { timestamp, signature };
}
