import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { metricsRegistry, resetMetricsRegistryForTests } from "../observability/metrics";
import {
  readHttpRequestBodyRejectedTotal,
  readHttpResponseBodyRejectedTotal,
  recordHttpRequestBodyRejected,
  recordHttpResponseBodyRejected,
} from "./http-json-pressure-monitor";

describe("http-json-pressure-monitor (B5 / NN-07)", () => {
  afterEach(() => {
    resetMetricsRegistryForTests();
  });

  it("increments ingress and egress reject counters", () => {
    recordHttpRequestBodyRejected();
    recordHttpRequestBodyRejected();
    recordHttpResponseBodyRejected();

    assert.equal(readHttpRequestBodyRejectedTotal(), 2);
    assert.equal(readHttpResponseBodyRejectedTotal(), 1);
    assert.equal(metricsRegistry.getMetric("http_request_body_rejected_total"), 2);
    assert.equal(metricsRegistry.getMetric("http_response_body_rejected_total"), 1);
  });
});
