import { assertSafeOutboundUrl } from "@repo/security/egress-url";

const URL_KEY_PATTERN = /(url|callback|webhook|endpoint)/i;

function collectHttpUrls(value: unknown, depth = 0): string[] {
  if (depth > 8) {
    return [];
  }
  if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) {
    return [value.trim()];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectHttpUrls(entry, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
      const nested = collectHttpUrls(entry, depth + 1);
      if (URL_KEY_PATTERN.test(key) && typeof entry === "string" && /^https?:\/\//i.test(entry.trim())) {
        return [entry.trim(), ...nested];
      }
      return nested;
    });
  }
  return [];
}

/** Validates outbound HTTP(S) URLs embedded in an outbox payload before dispatch. */
export async function assertOutboundUrlsInOutboxPayload(
  payload: Record<string, unknown>,
): Promise<void> {
  const urls = [...new Set(collectHttpUrls(payload))];
  for (const url of urls) {
    await assertSafeOutboundUrl(url);
  }
}
