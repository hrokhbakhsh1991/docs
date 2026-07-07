/**
 * P5-D-N-003 — TenantHttpProxy egress wire (EG-06)
 * @see docs/phase-18/platform-integrations-plane.mdoc
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isEgressHostNotAllowlistedError,
  isEgressUrlBlockedError,
} from "../src/integrations/egress/index.ts";
import { TenantHttpProxy } from "../src/proxy/tenant-http-proxy.ts";
import { runWithTenantContext } from "../src/tenant/tenant-request-context.ts";
import { integrationTenantId } from "./test-helpers.ts";

describe("egress-proxy-wire (P5-D EG-06)", () => {
  const tenantId = integrationTenantId();

  it("EG-06 blocks absolute loopback URL before upstream fetch", async () => {
    const proxy = new TenantHttpProxy({
      upstreamBaseUrl: "https://maps.example.test",
      egressAllowedHosts: ["maps.example.test"],
    });

    await runWithTenantContext(tenantId, async () => {
      await assert.rejects(
        () => proxy.fetch("http://127.0.0.1/internal"),
        (error: unknown) => {
          assert.ok(isEgressUrlBlockedError(error));
          return true;
        }
      );
    });
  });

  it("EG-06b blocks host outside proxy allowlist", async () => {
    const proxy = new TenantHttpProxy({
      upstreamBaseUrl: "https://maps.example.test",
      egressAllowedHosts: ["maps.example.test"],
    });

    await runWithTenantContext(tenantId, async () => {
      await assert.rejects(
        () => proxy.fetch("https://evil.example/steal"),
        (error: unknown) => {
          assert.ok(isEgressHostNotAllowlistedError(error));
          return true;
        }
      );
    });
  });

  it("EG-06c skips guard when egressGuard is false (mock upstream tests)", async () => {
    const proxy = new TenantHttpProxy({
      upstreamBaseUrl: "http://127.0.0.1:65535",
      egressGuard: false,
    });

    await runWithTenantContext(tenantId, async () => {
      await assert.rejects(
        () => proxy.fetch("/tiles"),
        (error: unknown) => {
          assert.ok(!isEgressUrlBlockedError(error));
          return true;
        }
      );
    });
  });
});
