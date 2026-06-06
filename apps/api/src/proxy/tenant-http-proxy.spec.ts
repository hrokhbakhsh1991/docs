import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const proxySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "tenant-http-proxy.ts"),
  "utf8"
);

describe("tenant HTTP proxy (source invariants / DEC-075)", () => {
  it("uses AbortSignal.timeout when caller omits signal", () => {
    assert.match(proxySource, /AbortSignal\.timeout/);
    assert.match(proxySource, /resolveProxyUpstreamTimeoutMs/);
  });

  it("gates fetch with circuit breaker", () => {
    assert.match(proxySource, /ProxyUpstreamCircuitBreaker/);
    assert.match(proxySource, /assertClosed/);
    assert.match(proxySource, /recordFailure/);
  });

  it("records upstream timeout via recordProxyUpstreamTimeout", () => {
    assert.match(proxySource, /recordProxyUpstreamTimeout/);
  });
});
