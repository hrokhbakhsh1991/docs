/**
 * Gap Closure P5.2.c — API plugin-registry pathNot must stay fail-closed.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDepcruiseApiPluginRegistryFromPathNot,
  DEPCRUISE_API_PLUGIN_REGISTRY_PRODUCT_PATH_NOT_FRAGMENTS,
  generateManifestBoundaryAllowlist,
} from "../codegen/workspace-registry/domains/boundary-allowlist.mjs";

/** Historical hand-written body before P5.2.c — must not loosen. */
const FROZEN_PATH_NOT =
  "(workspace-plugin-registry\\.generated|workspace-tour-write-bindings\\.generated|\\.generated\\.ts$|\\.spec\\.ts$|denali-finance|workspace-finance|urban|canonical|internal/provisioning|settings/|tours/|tenant/tenant-branding-storage)";

describe("DEPCRUISE_API_PLUGIN_REGISTRY_FROM_PATH_NOT (Gap Closure P5.2.c)", () => {
  it("assembled pathNot matches frozen historical body", () => {
    assert.equal(buildDepcruiseApiPluginRegistryFromPathNot(), FROZEN_PATH_NOT);
  });

  it("product pathNot fragments stay explicit and fail-closed", () => {
    assert.deepEqual([...DEPCRUISE_API_PLUGIN_REGISTRY_PRODUCT_PATH_NOT_FRAGMENTS], [
      "denali-finance",
      "urban",
    ]);
    assert.ok(!DEPCRUISE_API_PLUGIN_REGISTRY_PRODUCT_PATH_NOT_FRAGMENTS.includes("denali"));
    assert.ok(!DEPCRUISE_API_PLUGIN_REGISTRY_PRODUCT_PATH_NOT_FRAGMENTS.includes("starter"));
  });

  it("generated allowlist embeds the frozen pathNot and product fragment list", () => {
    const src = generateManifestBoundaryAllowlist([
      { id: "starter", package: "@app-tour/workspace-starter" },
      { id: "urban", package: "@app-tour/workspace-urban", memberPortal: {} },
    ]);
    assert.match(src, /DEPCRUISE_API_PLUGIN_REGISTRY_FROM_PATH_NOT/);
    assert.match(
      src,
      new RegExp(JSON.stringify(FROZEN_PATH_NOT).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
    const productFragBlock = src.match(
      /DEPCRUISE_API_PLUGIN_REGISTRY_PRODUCT_PATH_NOT_FRAGMENTS = Object\.freeze\(([\s\S]*?)\);/
    );
    assert.ok(productFragBlock);
    assert.match(productFragBlock[1], /"denali-finance"/);
    assert.match(productFragBlock[1], /"urban"/);
    assert.doesNotMatch(productFragBlock[1], /"starter"/);
    assert.doesNotMatch(productFragBlock[1], /"denali"/);
  });
});
