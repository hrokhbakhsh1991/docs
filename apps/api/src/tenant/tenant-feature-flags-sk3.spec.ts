/**
 * SK3-FLAGS — TenantFeatureFlags growth + SK2.C notify gate.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseFeatureFlagsFromTheme } from "./resolve-tenant-feature-flags";

describe("SK3 TenantFeatureFlags (inAppRegistrationApprovedNotify)", () => {
  it("defaults both flags true when theme / featureFlags omitted", () => {
    assert.deepEqual(parseFeatureFlagsFromTheme(null), {
      advancedRuleEngine: true,
      inAppRegistrationApprovedNotify: true,
    });
    assert.deepEqual(parseFeatureFlagsFromTheme({}), {
      advancedRuleEngine: true,
      inAppRegistrationApprovedNotify: true,
    });
    assert.deepEqual(parseFeatureFlagsFromTheme({ featureFlags: {} }), {
      advancedRuleEngine: true,
      inAppRegistrationApprovedNotify: true,
    });
  });

  it("only explicit false disables inAppRegistrationApprovedNotify", () => {
    assert.equal(
      parseFeatureFlagsFromTheme({
        featureFlags: { inAppRegistrationApprovedNotify: false },
      }).inAppRegistrationApprovedNotify,
      false
    );
    assert.equal(
      parseFeatureFlagsFromTheme({
        featureFlags: { inAppRegistrationApprovedNotify: true },
      }).inAppRegistrationApprovedNotify,
      true
    );
    assert.equal(
      parseFeatureFlagsFromTheme({
        featureFlags: { inAppRegistrationApprovedNotify: "no" },
      }).inAppRegistrationApprovedNotify,
      true
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
