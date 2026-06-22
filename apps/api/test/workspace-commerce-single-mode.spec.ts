/**
 * P5-C-N-007 — single active commerce mode guard (GU-01)
 * @see docs/phase-18/platform-workspace-commerce.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  safeParseWorkspaceCommerceConfig,
  workspaceCommerceConfigSchema,
} from "@app-tour/workspace-sdk/metadata";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("workspace-commerce-single-mode (P5-C GU-01)", () => {
  it("GU-01 rejects gateway paymentMode without gatewayProvider", () => {
    const result = safeParseWorkspaceCommerceConfig({
      paymentMode: "gateway",
      gatewayProvider: null,
      currency: "IRR",
    });
    assert.equal(result.success, false);
  });

  it("GU-01 rejects offline_receipt with gatewayProvider set", () => {
    const result = safeParseWorkspaceCommerceConfig({
      paymentMode: "offline_receipt",
      gatewayProvider: "zibal",
      currency: "IRR",
    });
    assert.equal(result.success, false);
  });

  it("GU-01 accepts gateway mode when provider is set", () => {
    const parsed = workspaceCommerceConfigSchema.parse({
      paymentMode: "gateway",
      gatewayProvider: "stripe",
    });
    assert.equal(parsed.gatewayProvider, "stripe");
  });

  it("GU-01 schema source is workspace-sdk commerce-schema", () => {
    const schema = readFileSync(
      join(repoRoot, "packages/workspace-sdk/src/metadata/commerce-schema.ts"),
      "utf8"
    );
    assert.match(schema, /gatewayProvider is required when paymentMode is gateway/);
  });
});
