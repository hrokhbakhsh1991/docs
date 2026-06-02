import assert from "node:assert/strict";
import test from "node:test";

import { inflightBffGet } from "./inflight-bff-get";

test("inflightBffGet shares parsed payload, not a single-use Response body", async () => {
  let fetchCount = 0;
  const shared = inflightBffGet("test-key", async () => {
    fetchCount += 1;
    return { authenticated: true as const, user_id: "u1" };
  });

  const [a, b] = await Promise.all([shared, inflightBffGet("test-key", async () => ({ authenticated: false }))]);
  assert.equal(fetchCount, 1);
  assert.equal(a.authenticated, true);
  assert.equal(b.authenticated, true);
});
