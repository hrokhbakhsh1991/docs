import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveGuestLandingWhySectionGate } from "../codegen/workspace-registry/domains/guest-catalog.mjs";

describe("resolveGuestLandingWhySectionGate (alias expiry)", () => {
  it("accepts whySection boolean", () => {
    assert.equal(resolveGuestLandingWhySectionGate({ whySection: true }, "denali"), true);
    assert.equal(resolveGuestLandingWhySectionGate({ whySection: false }, "urban"), false);
  });

  it("rejects missing whySection", () => {
    assert.throws(
      () => resolveGuestLandingWhySectionGate({}, "starter"),
      /whySection must be boolean/,
    );
  });

  it("rejects expired whyDenali alias even when whySection present", () => {
    assert.throws(
      () =>
        resolveGuestLandingWhySectionGate({ whySection: true, whyDenali: true }, "denali"),
      /whyDenali alias expired/,
    );
  });

  it("rejects whyDenali-only legacy shape", () => {
    assert.throws(
      () => resolveGuestLandingWhySectionGate({ whyDenali: false }, "urban"),
      /whyDenali alias expired/,
    );
  });
});
