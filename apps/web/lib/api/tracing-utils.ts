/**
 * W3C trace / request id helpers — Edge, Node, and browser safe (no node:crypto).
 */

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateRequestId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${randomHex(4)}-${randomHex(2)}-${randomHex(2)}-${randomHex(2)}-${randomHex(6)}`;
}

/**
 * Generates a W3C traceparent header.
 * Format: 00-{traceId}-{spanId}-{flags}
 * @see https://www.w3.org/TR/trace-context/#traceparent-header
 */
export function generateTraceparent(): string {
  const traceId = randomHex(16);
  const spanId = randomHex(8);
  return `00-${traceId}-${spanId}-01`;
}

export function getRequestIdFromHeaders(headers: Headers): string | undefined {
  return headers.get("x-request-id") || headers.get("X-Request-Id") || undefined;
}

export function getTraceparentFromHeaders(headers: Headers): string | undefined {
  return headers.get("traceparent") || undefined;
}
