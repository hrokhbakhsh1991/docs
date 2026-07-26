import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveMemberSessionCookieDomain } from "../src/host/resolve-member-session-cookie-domain";

describe("resolveMemberSessionCookieDomain", () => {
  it("PCMS-COOK-01 custom apex portal returns registrable apex", () => {
    assert.equal(
      resolveMemberSessionCookieDomain("portal.alpine.club:3003", "localhost"),
      "alpine.club"
    );
  });

  it("PCMS-COOK-02 legacy platform portal localhost returns undefined", () => {
    assert.equal(
      resolveMemberSessionCookieDomain("alpine.portal.localhost:3003", "localhost"),
      undefined
    );
  });

  it("PCMS-COOK-03 inverted portal localhost returns club.localhost share parent", () => {
    assert.equal(
      resolveMemberSessionCookieDomain("portal.denali.localhost:3003", "localhost"),
      "denali.localhost"
    );
  });

  it("PCMS-COOK-03 marketing custom apex returns same registrable apex", () => {
    assert.equal(resolveMemberSessionCookieDomain("alpine.club", "localhost"), "alpine.club");
  });
});
