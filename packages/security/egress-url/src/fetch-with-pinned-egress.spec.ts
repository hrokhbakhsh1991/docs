import assert from "node:assert/strict";
import test from "node:test";

import { fetchWithPinnedEgress } from "./fetch-with-pinned-egress";
import { EgressUrlForbiddenError } from "./egress-url-forbidden.error";

test("fetchWithPinnedEgress blocks mismatched Host header override", async () => {
  let caught: unknown;
  try {
    await fetchWithPinnedEgress("https://example.com/webhook", {
      egressCoupledValidateOnly: true,
      headers: { Host: "evil.internal" },
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Error);
  assert.equal((caught as Error).message, "EGRESS_AGENT_HIJACKING_DETECTED");
});

test("fetchWithPinnedEgress validates without dispatch when egressCoupledValidateOnly is set", async () => {
  const response = await fetchWithPinnedEgress("https://example.com/webhook", {
    egressCoupledValidateOnly: true,
  });
  assert.equal(response.status, 204);
});

test("fetchWithPinnedEgress blocks private callback targets during coupled validation", async () => {
  let caught: unknown;
  try {
    await fetchWithPinnedEgress("http://127.0.0.1/callback", {
      egressCoupledValidateOnly: true,
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof EgressUrlForbiddenError);
});
