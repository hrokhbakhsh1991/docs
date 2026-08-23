/**
 * P5-C-N-002 — workspace commerce config schema (SCH-01..03)
 * @see docs/phase-18/platform-workspace-commerce.mdoc
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_WORKSPACE_COMMERCE_CONFIG,
  parseWorkspaceCommerceConfig,
  safeParseWorkspaceCommerceConfig,
  workspaceCommerceConfigSchema,
} from "../src/metadata/commerce-schema.js";

describe("commerce-schema (P5-C SCH-01..03)", () => {
  it("SCH-01 paymentMode accepts offline_receipt and gateway", () => {
    assert.deepEqual(
      parseWorkspaceCommerceConfig({ paymentMode: "offline_receipt" }),
      DEFAULT_WORKSPACE_COMMERCE_CONFIG
    );
    assert.deepEqual(
      parseWorkspaceCommerceConfig({
        paymentMode: "gateway",
        gatewayProvider: "zibal",
        currency: "CAD",
      }),
      {
        paymentMode: "gateway",
        gatewayProvider: "zibal",
        currency: "CAD",
      }
    );
  });

  it("SCH-02 gatewayProvider accepts zibal, stripe, or null", () => {
    assert.equal(
      parseWorkspaceCommerceConfig({
        paymentMode: "gateway",
        gatewayProvider: "stripe",
        currency: "USD",
      }).gatewayProvider,
      "stripe"
    );
    assert.equal(parseWorkspaceCommerceConfig({}).gatewayProvider, null);
  });

  it("SCH-03 default paymentMode is offline_receipt", () => {
    assert.equal(DEFAULT_WORKSPACE_COMMERCE_CONFIG.paymentMode, "offline_receipt");
    assert.equal(workspaceCommerceConfigSchema.parse({}).paymentMode, "offline_receipt");
  });

  it("SCH-03b default commerce does not invent a workspace currency", () => {
    assert.equal(DEFAULT_WORKSPACE_COMMERCE_CONFIG.currency, "");
    assert.equal(workspaceCommerceConfigSchema.parse({}).currency, "");
  });

  it("GU-01 shape rejects gateway mode without provider", () => {
    const result = safeParseWorkspaceCommerceConfig({
      paymentMode: "gateway",
      gatewayProvider: null,
    });
    assert.equal(result.success, false);
  });

  it("GU-01b shape rejects gateway mode without explicit currency", () => {
    const result = safeParseWorkspaceCommerceConfig({
      paymentMode: "gateway",
      gatewayProvider: "zibal",
    });
    assert.equal(result.success, false);
  });

  it("rejects offline_receipt with gatewayProvider set", () => {
    const result = safeParseWorkspaceCommerceConfig({
      paymentMode: "offline_receipt",
      gatewayProvider: "zibal",
    });
    assert.equal(result.success, false);
  });
});
