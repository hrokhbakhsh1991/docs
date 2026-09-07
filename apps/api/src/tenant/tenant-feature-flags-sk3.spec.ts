/**
 * SK3-FLAGS — TenantFeatureFlags growth + SK2.C notify gate.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseFeatureFlagsFromTheme } from "./resolve-tenant-feature-flags";

describe("SK3 TenantFeatureFlags (inAppRegistrationApprovedNotify)", () => {
  it("defaults advancedRuleEngine true and legacy notify off when theme / featureFlags omitted (SEC-042)", () => {
    assert.deepEqual(parseFeatureFlagsFromTheme(null), {
      advancedRuleEngine: true,
      inAppRegistrationApprovedNotify: false,
    });
    assert.deepEqual(parseFeatureFlagsFromTheme({}), {
      advancedRuleEngine: true,
      inAppRegistrationApprovedNotify: false,
    });
    assert.deepEqual(parseFeatureFlagsFromTheme({ featureFlags: {} }), {
      advancedRuleEngine: true,
      inAppRegistrationApprovedNotify: false,
    });
  });

  it("only explicit true enables inAppRegistrationApprovedNotify legacy path", () => {
    assert.equal(
      parseFeatureFlagsFromTheme({
        featureFlags: { inAppRegistrationApprovedNotify: false },
      }).inAppRegistrationApprovedNotify,
      false,
    );
    assert.equal(
      parseFeatureFlagsFromTheme({
        featureFlags: { inAppRegistrationApprovedNotify: true },
      }).inAppRegistrationApprovedNotify,
      true,
    );
    assert.equal(
      parseFeatureFlagsFromTheme({
        featureFlags: { inAppRegistrationApprovedNotify: "no" },
      }).inAppRegistrationApprovedNotify,
      false,
    );
  });

  it("preserves advancedRuleEngine parse semantics alongside new flag", () => {
    const flags = parseFeatureFlagsFromTheme({
      featureFlags: {
        advancedRuleEngine: false,
        inAppRegistrationApprovedNotify: false,
      },
    });
    assert.deepEqual(flags, {
      advancedRuleEngine: false,
      inAppRegistrationApprovedNotify: false,
    });
  });
});
