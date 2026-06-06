import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeRelayBackoff } from "./compute-relay-backoff";

describe("computeRelayBackoff", () => {
  it("returns baseMs on first attempt without jitter when random is zero", () => {
    assert.equal(
      computeRelayBackoff({
        attempt: 1,
        baseMs: 1000,
        maxMs: 8000,
        random: () => 0,
      }),
      1000
    );
  });

  it("doubles delay per attempt until capped", () => {
    assert.equal(
      computeRelayBackoff({ attempt: 3, baseMs: 100, maxMs: 1000, random: () => 0 }),
      400
    );
    assert.equal(
      computeRelayBackoff({ attempt: 10, baseMs: 100, maxMs: 500, random: () => 0 }),
      500
    );
  });

  it("never exceeds maxMs including jitter", () => {
    for (let i = 0; i < 50; i += 1) {
      const delay = computeRelayBackoff({ attempt: 5, baseMs: 25, maxMs: 200 });
      assert.ok(delay >= 25 && delay <= 200);
    }
  });

  it("adds jitter within 25% of capped delay", () => {
    const delay = computeRelayBackoff({
      attempt: 2,
      baseMs: 100,
      maxMs: 1000,
      random: () => 1,
    });
    assert.equal(delay, 250);
  });
});
