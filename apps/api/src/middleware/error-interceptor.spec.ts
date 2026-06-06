import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveCorrelationId } from "./error-interceptor";
import { runWithTraceContext } from "../observability/trace-request-context";

describe("resolveCorrelationId (TRACE-REGEN-02 / DEC-126)", () => {
  it("requires trace ALS — no randomUUID fallback", () => {
    assert.throws(() => resolveCorrelationId(), /TRACE_CONTEXT_NOT_BOUND/);
  });

  it("returns active trace id when ALS is bound", () => {
    void runWithTraceContext("ingress-trace-abc", () => {
      assert.equal(resolveCorrelationId(), "ingress-trace-abc");
    });
  });
});
