/**
 * P5-D-N-002 — egress URL guard (EG-01..05)
 * @see docs/phase-18/platform-integrations-plane.mdoc
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertSafeOutboundUrl,
  EgressHostNotAllowlistedError,
  EgressUrlBlockedError,
  isEgressHostNotAllowlistedError,
  isEgressUrlBlockedError,
} from "../src/integrations/egress/index.ts";

describe("egress-url (P5-D EG-01..05)", () => {
  it("EG-01 blocks loopback IPv4 literal", () => {
    assert.throws(
      () => assertSafeOutboundUrl("http://127.0.0.1/internal"),
      (error: unknown) => {
        assert.ok(isEgressUrlBlockedError(error));
        assert.equal(error.code, "EGRESS_URL_BLOCKED");
        assert.match(error.message, /127\.0\.0\.1/);
        return true;
      }
    );
  });

  it("EG-02 blocks cloud metadata IPv4 literal", () => {
    assert.throws(
      () => assertSafeOutboundUrl("http://169.254.169.254/latest/meta-data/"),
      (error: unknown) => {
        assert.ok(isEgressUrlBlockedError(error));
        assert.match(error.message, /169\.254\.169\.254/);
        return true;
      }
    );
  });

  it("EG-02b blocks metadata.google.internal hostname", () => {
    assert.throws(
      () => assertSafeOutboundUrl("http://metadata.google.internal/computeMetadata/v1/"),
      (error: unknown) => {
        assert.ok(error instanceof EgressUrlBlockedError);
        assert.match(error.message, /metadata\.google\.internal/);
        return true;
      }
    );
  });

  it("EG-03 blocks non-http(s) schemes", () => {
    assert.throws(
      () => assertSafeOutboundUrl("ftp://gateway.zibal.ir/file"),
      (error: unknown) => {
        assert.ok(isEgressUrlBlockedError(error));
        assert.match(error.message, /protocol:ftp:/);
        return true;
      }
    );
  });

  it("EG-04 rejects host outside explicit allowlist", () => {
    assert.throws(
      () =>
        assertSafeOutboundUrl({
          url: "https://evil.example/request",
          allowedHosts: ["gateway.zibal.ir", "api.stripe.com"],
        }),
      (error: unknown) => {
        assert.ok(isEgressHostNotAllowlistedError(error));
        assert.equal(error.code, "EGRESS_HOST_NOT_ALLOWLISTED");
        assert.match(error.message, /evil\.example/);
        return true;
      }
    );
  });

  it("EG-04 allows host on explicit allowlist", () => {
    const url = assertSafeOutboundUrl({
      url: "https://gateway.zibal.ir/v1/request",
      allowedHosts: ["gateway.zibal.ir"],
    });
    assert.equal(url.hostname, "gateway.zibal.ir");
    assert.equal(url.protocol, "https:");
  });

  it("EG-05 blocks RFC1918 literal without allowlist bypass", () => {
    assert.throws(
      () => assertSafeOutboundUrl("http://10.0.0.5/hook"),
      (error: unknown) => {
        assert.ok(isEgressUrlBlockedError(error));
        assert.match(error.message, /private_ipv4:10\.0\.0\.5/);
        return true;
      }
    );
  });

  it("returns parsed URL for public https endpoint when no allowlist", () => {
    const url = assertSafeOutboundUrl("https://api.stripe.com/v1/account_links");
    assert.equal(url.host, "api.stripe.com");
  });
});
