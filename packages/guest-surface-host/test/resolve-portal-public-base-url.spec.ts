import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolvePortalPublicBaseUrl,
  resolvePortalRegistrationUrl,
  resolvePortalMemberAreaUrl,
} from "../src/resolve-portal-public-base-url";

describe("resolve-portal-public-base-url", () => {
  it("WRS-GSH-03 custom apex marketing → portal sibling", () => {
    assert.equal(
      resolvePortalPublicBaseUrl("denali.club"),
      "http://portal.denali.club:3003"
    );
  });

  it("WRS-GSH-04 registration URL on custom apex", () => {
    assert.equal(
      resolvePortalRegistrationUrl("denali.club", "tour-1"),
      "http://portal.denali.club:3003/catalog/tour-1/register"
    );
    assert.equal(resolvePortalRegistrationUrl("denali.club", "tour-1").includes("shop."), false);
  });

  it("PCMS-03 member area URL on custom apex", () => {
    assert.equal(
      resolvePortalMemberAreaUrl("denali.club"),
      "http://portal.denali.club:3003/me/registrations"
    );
  });
});
