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

  it("PCMS-COOK-03 local inverted portal shares with workspace apex", () => {
    assert.equal(
      resolveMemberSessionCookieDomain("portal.denali.localhost:3003", "localhost"),
      "denali.localhost"
    );
  });

  it("PCMS-COOK-03 canonical platform portal returns workspace apex", () => {
    assert.equal(
      resolveMemberSessionCookieDomain("portal.denali.shenski.com", "shenski.com"),
      "denali.shenski.com"
    );
  });

  it("PCMS-COOK-01 legacy platform portal remains host-only", () => {
    assert.equal(
      resolveMemberSessionCookieDomain("denali.portal.shenski.com", "shenski.com"),
      undefined
    );
  });

  it("PCMS-COOK-03 marketing custom apex returns same registrable apex", () => {
    assert.equal(resolveMemberSessionCookieDomain("alpine.club", "localhost"), "alpine.club");
  });

  it("keeps B portal cookies scoped to B for private staging tenant apexes", () => {
    const tenantA = resolveMemberSessionCookieDomain("portal.denali.staging.test", "shenski.com");
    const tenantB = resolveMemberSessionCookieDomain("portal.qa2.staging.test", "shenski.com");

    assert.equal(tenantA, "denali.staging.test");
    assert.equal(tenantB, "qa2.staging.test");
    assert.notEqual(tenantB, tenantA);
  });

  it("keeps proposed shenski staging portal hosts host-only", () => {
    assert.equal(
      resolveMemberSessionCookieDomain("staging-portal-denali.shenski.com", "shenski.com"),
      undefined
    );
    assert.equal(
      resolveMemberSessionCookieDomain("staging-portal-qa2.shenski.com", "shenski.com"),
      undefined
    );
  });
});
