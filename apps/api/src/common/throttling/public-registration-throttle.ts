import { createHash } from "node:crypto";
import type { ExecutionContext } from "@nestjs/common";

/** Same client IP resolution as the former in-memory RateLimitGuard (trust proxy aware). */
export function resolveThrottleClientIp(req: Record<string, unknown>): string {
  const headers = req.headers as Record<string, unknown> | undefined;
  const forwarded = headers?.["x-forwarded-for"];
  const firstForwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === "string"
      ? forwarded.split(",")[0]
      : undefined;
  const normalizedForwarded = firstForwardedIp?.trim();
  if (normalizedForwarded) {
    return normalizedForwarded;
  }
  const ip = req.ip;
  return typeof ip === "string" && ip.trim() !== "" ? ip : "unknown";
}

/**
 * One Redis bucket per client IP across both public registration routes (matches legacy guard).
 * Default ThrottlerGuard keys include handler name, which would split limits per endpoint.
 */
export function publicRegistrationThrottleKey(
  _context: ExecutionContext,
  tracker: string,
  throttlerName: string
): string {
  return createHash("sha256")
    .update(`public-registration-shared:${throttlerName}:${tracker}`)
    .digest("hex");
}
