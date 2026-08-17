import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveGuestChromeDisplayName } from "../src/resolve-guest-chrome-display-name";

describe("resolveGuestChromeDisplayName", () => {
  it("GL-BRAND-01 prefers trimmed displayName over i18n fallback", () => {
    assert.equal(resolveGuestChromeDisplayName("  shenski  ", "Club"), "shenski");
  });

  it("GL-BRAND-01 uses fallback when displayName is empty or whitespace", () => {
    assert.equal(resolveGuestChromeDisplayName(null, "Club"), "Club");
    assert.equal(resolveGuestChromeDisplayName(undefined, "باشگاه"), "باشگاه");
    assert.equal(resolveGuestChromeDisplayName("   ", "Club"), "Club");
  });

  it("GL-BRAND-01 does not invent Portal or plugin id", () => {
    assert.notEqual(resolveGuestChromeDisplayName(null, "Club"), "Portal");
    assert.notEqual(resolveGuestChromeDisplayName("", "Club"), "denali");
  });
});
