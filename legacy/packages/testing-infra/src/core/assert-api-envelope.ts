import assert from "node:assert/strict";

const RETRYABILITY_VALUES = new Set([
  "NO_RETRY",
  "SAFE_RETRY",
  "RETRY_WITH_BACKOFF",
  "RETRY_AFTER_ACTION",
]);

export type ApiErrorEnvelopeBody = {
  requestId?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
    correlationId?: unknown;
    details?: unknown;
    retryability?: unknown;
  };
};

/** Asserts the standard API error envelope shape (no supertest dependency). */
export function assertApiErrorEnvelope(body: ApiErrorEnvelopeBody): void {
  assert.equal(typeof body, "object");
  assert.equal(typeof body.requestId, "string");
  assert.equal(typeof body.error, "object");
  assert.equal(typeof body.error?.code, "string");
  assert.equal(typeof body.error?.message, "string");
  assert.equal(typeof body.error?.correlationId, "string");
  assert.equal(typeof body.error?.details, "object");
  assert.equal(typeof body.error?.retryability, "string");
  assert.equal(RETRYABILITY_VALUES.has(body.error?.retryability as string), true);
}

/** Ensures error responses do not leak session tokens or JWT-shaped strings. */
export function assertNoSessionOrJwtInBody(body: Record<string, unknown>): void {
  assert.equal(body.session_token, undefined);
  assert.equal(body.access_token, undefined);
  assert.equal(body.token, undefined);
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== "string") {
      continue;
    }
    const parts = value.split(".");
    if (parts.length === 3 && parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))) {
      assert.fail(`unexpected JWT-shaped value in response key "${key}"`);
    }
  }
}
