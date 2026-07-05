import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GuestConformanceNotConfiguredError,
  resolveGuestConformanceLevelForPlugin,
} from "../src/catalog/resolve-guest-conformance-level";

describe("resolveGuestConformanceLevelForPlugin", () => {
  it("SDK-GCONF-01 resolves denali as L4 reference and urban as L3", () => {
    assert.equal(resolveGuestConformanceLevelForPlugin("denali"), "L4");
    assert.equal(resolveGuestConformanceLevelForPlugin("urban"), "L3");
  });

  it("SDK-GCONF-02 starter is L0", () => {
    assert.equal(resolveGuestConformanceLevelForPlugin("starter"), "L0");
  });

  it("SDK-GCONF-03 unknown plugin is fail-closed", () => {
    assert.throws(
      () => resolveGuestConformanceLevelForPlugin("missing"),
      GuestConformanceNotConfiguredError
    );
  });
});
