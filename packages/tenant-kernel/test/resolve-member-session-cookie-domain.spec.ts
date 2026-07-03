import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveMemberSessionCookieDomain } from "../src/host/resolve-member-session-cookie-domain";

describe("resolveMemberSessionCookieDomain", () => {
  it("PCMS-COOK-01 custom apex portal returns registrable apex", () => {
    assert.equal(
      resolveMemberSessionCookieDomain("portal.denali.club:3003", "localhost"),
      "denali.club"
    );
  });

  it("PCMS-COOK-02 platform portal localhost returns undefined", () => {
    assert.equal(
      resolveMemberSessionCookieDomain("denali.portal.localhost:3003", "localhost"),
      undefined
    );
  });

  it("PCMS-COOK-03 marketing custom apex returns same registrable apex", () => {
    assert.equal(resolveMemberSessionCookieDomain("denali.club", "localhost"), "denali.club");
  });
});
