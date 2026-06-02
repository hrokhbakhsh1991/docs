import assert from "node:assert/strict";
import test from "node:test";

import {
  checkSlidingWindowRateLimit,
  resetSlidingWindowRateLimitStore,
} from "./sliding-window-per-key";

test("sliding window allows up to limit then returns 429 metadata", () => {
  resetSlidingWindowRateLimitStore();
  const key = "test-ip";
  const windowMs = 60_000;
  const t0 = 1_700_000_000_000;

  for (let i = 0; i < 30; i += 1) {
    const result = checkSlidingWindowRateLimit(key, {
      limit: 30,
      windowMs,
      now: t0 + i,
    });
    assert.equal(result.allowed, true);
  }

  const blocked = checkSlidingWindowRateLimit(key, {
    limit: 30,
    windowMs,
    now: t0 + 30,
  });
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) {
    assert.ok(blocked.retryAfterSec >= 1);
  }
});

test("sliding window expires old timestamps outside the window", () => {
  resetSlidingWindowRateLimitStore();
  const key = "expiry-ip";
  const windowMs = 60_000;
  const t0 = 1_700_000_000_000;

  for (let i = 0; i < 30; i += 1) {
    checkSlidingWindowRateLimit(key, { limit: 30, windowMs, now: t0 + i });
  }

  const afterWindow = checkSlidingWindowRateLimit(key, {
    limit: 30,
    windowMs,
    now: t0 + windowMs + 1,
  });
  assert.equal(afterWindow.allowed, true);
});
