import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { WORKSPACE_THEME_CSS_VARIABLE } from "@app-tour/workspace-sdk";

import {
  buildDenaliTokenBridgeContexts,
  DENALI_GUEST_SURFACE_CSS_VARIABLES,
} from "../src/theme/denali-token-bridge.js";
import { getDenaliWorkspacePlugin } from "../src/denali.plugin.js";

describe("denali-token-bridge", () => {
  it("resolves shared primary from theme/shared palette + semantics", () => {
    const bridge = buildDenaliTokenBridgeContexts();
    assert.equal(bridge.shared["--ws-color-primary"], "#059669");
    assert.equal(bridge.portal.cssVariables["--ws-color-primary"], "#059669");
    assert.equal(bridge.admin.cssVariables["--ws-color-primary"], "#059669");
  });

  it("injects admin-only sidebar tokens on admin context", () => {
    const bridge = buildDenaliTokenBridgeContexts();
    assert.equal(bridge.admin.cssVariables["--ws-sidebar-primary"], "#059669");
    assert.equal(bridge.portal.cssVariables["--ws-sidebar-primary"], undefined);
    assert.equal(bridge.marketing.cssVariables["--ws-sidebar-primary"], undefined);
  });

  it("guest surface export matches portal context", () => {
    const bridge = buildDenaliTokenBridgeContexts();
    assert.deepEqual(DENALI_GUEST_SURFACE_CSS_VARIABLES, bridge.shared);
    assert.deepEqual(bridge.portal.cssVariables, bridge.shared);
  });

  it("plugin theme uses admin bridge cssVariables", () => {
    const plugin = getDenaliWorkspacePlugin();
    assert.equal(plugin.theme?.cssVariables["--ws-color-primary"], "#059669");
    assert.equal(
      plugin.theme?.cssVariables[WORKSPACE_THEME_CSS_VARIABLE.colorAccent],
      "var(--color-primary)",
    );
    assert.equal(plugin.theme?.cssVariables["--ws-sidebar-primary"], "#059669");
  });

  it("guest manifest theme literals match admin bridge contract (D1)", () => {
    const bridge = buildDenaliTokenBridgeContexts();
    const portalManifest = readFileSync(
      new URL("../../../../apps/portal/src/bootstrap/workspace-guest-manifest-themes.generated.ts", import.meta.url),
      "utf8"
    );
    for (const [key, value] of Object.entries(bridge.admin.cssVariables)) {
      if (typeof value !== "string" || !key.startsWith("--ws-")) {
        continue;
      }
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(
        portalManifest,
        new RegExp(`"${escapedKey}": "${escapedValue}"`),
        `portal guest manifest theme missing ${key}`,
      );
    }
  });
});
