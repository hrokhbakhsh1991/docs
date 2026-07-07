/**
 * P5-C-N-009 — gateway commerce activation blocked until P5-D (GU-02)
 * @see docs/phase-18/platform-workspace-commerce.mdoc
 */
import assert from "node:assert/strict";
import type { ServerResponse } from "node:http";
import { afterEach, describe, it } from "node:test";

import { handleHttpError } from "../src/middleware/error-interceptor.ts";
import { runWithTraceContext } from "../src/observability/trace-request-context.ts";
import {
  assertWorkspaceCommerceGatewayActivationAllowed,
  isWorkspaceCommerceGatewayActivationEnabled,
  isWorkspaceCommerceGatewayBlockedError,
  WorkspaceCommerceGatewayBlockedError,
} from "../src/workspace-metadata/assert-workspace-commerce-gateway-blocked.ts";

function createMockResponse(): ServerResponse & {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
} {
  const headers: Record<string, string> = {};
  return {
    statusCode: 0,
    headers,
    body: "",
    writableEnded: false,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    end(payload?: string) {
      if (payload !== undefined) {
        this.body = payload;
      }
      this.writableEnded = true;
    },
  } as unknown as ServerResponse & {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  };
}

describe("workspace-commerce-gateway-blocked (P5-C GU-02)", () => {
  const originalLift = process.env.P5_D_GATEWAY_ACTIVATION_ENABLED;

  afterEach(() => {
    if (originalLift === undefined) {
      delete process.env.P5_D_GATEWAY_ACTIVATION_ENABLED;
    } else {
      process.env.P5_D_GATEWAY_ACTIVATION_ENABLED = originalLift;
    }
  });

  it("GU-02 blocks gateway mode with 503-class error when lift env unset", () => {
    delete process.env.P5_D_GATEWAY_ACTIVATION_ENABLED;
    assert.throws(
      () =>
        assertWorkspaceCommerceGatewayActivationAllowed({
          paymentMode: "gateway",
        }),
      (error: unknown) => {
        assert.ok(isWorkspaceCommerceGatewayBlockedError(error));
        assert.equal(error.statusCode, 503);
        assert.equal(error.code, "WORKSPACE_COMMERCE_GATEWAY_BLOCKED");
        return true;
      }
    );
  });

  it("GU-02 lift env enables gateway activation (P5-D-N-010)", () => {
    process.env.P5_D_GATEWAY_ACTIVATION_ENABLED = "true";
    assert.equal(isWorkspaceCommerceGatewayActivationEnabled(), true);
    assert.doesNotThrow(() =>
      assertWorkspaceCommerceGatewayActivationAllowed({ paymentMode: "gateway" })
    );
  });

  it("GU-02 allows offline_receipt activation", () => {
    assert.doesNotThrow(() =>
      assertWorkspaceCommerceGatewayActivationAllowed({ paymentMode: "offline_receipt" })
    );
  });

  it("GU-02a handleHttpError maps typed gateway block to HTTP 503", () => {
    const res = createMockResponse();

    void runWithTraceContext("trace-commerce-gateway-block", () => {
      handleHttpError(res, new WorkspaceCommerceGatewayBlockedError());
    });

    assert.equal(res.statusCode, 503);
    const payload = JSON.parse(res.body) as { code?: string; error?: string };
    assert.equal(payload.code, "WORKSPACE_COMMERCE_GATEWAY_BLOCKED");
    assert.equal(payload.error, "service_unavailable");
  });
});
