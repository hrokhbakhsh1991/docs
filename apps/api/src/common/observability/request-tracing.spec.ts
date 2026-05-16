import assert from "node:assert/strict";
import test from "node:test";
import { requestContextStorage } from "../request-context/request-context";
import {
  attachCorrelationMetadata,
  getCorrelationId,
  sanitizeCorrelationMetadata,
  tryGetCorrelationId
} from "./request-tracing";

test("sanitizeCorrelationMetadata drops reserved keys", () => {
  assert.deepEqual(
    sanitizeCorrelationMetadata({
      job: "reconcile",
      tenant_id: "must-not-appear",
      access_token: "x"
    }),
    { job: "reconcile" }
  );
});

test("tryGetCorrelationId prefers store correlationId over requestId", () => {
  requestContextStorage.run(
    { requestId: "req-a", correlationId: "corr-b" },
    () => {
      assert.equal(tryGetCorrelationId(), "corr-b");
      assert.equal(getCorrelationId(), "corr-b");
    }
  );
});

test("tryGetCorrelationId falls back to requestId", () => {
  requestContextStorage.run({ requestId: "req-only" }, () => {
    assert.equal(tryGetCorrelationId(), "req-only");
  });
});

test("attachCorrelationMetadata merges into ALS for later reads", () => {
  requestContextStorage.run({ requestId: "r1", correlationId: "r1" }, () => {
    attachCorrelationMetadata({ batch: "7" });
    const store = requestContextStorage.getStore();
    assert.equal(store?.attachedLogFields?.batch, "7");
  });
});

test("getCorrelationId throws without ALS", () => {
  assert.throws(() => getCorrelationId(), /Correlation id is not available/);
});
