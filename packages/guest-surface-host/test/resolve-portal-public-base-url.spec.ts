import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolvePortalMemberModuleUrl,
  resolvePortalPublicBaseUrl,
  resolvePortalRegistrationUrl,
} from "../src/index";

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
});

describe("resolve-portal-member-module-url — PS-3", () => {
  it("GSH-PS3-01 default module URL uses registry default on custom apex", () => {
    assert.equal(
      resolvePortalMemberModuleUrl("denali.club"),
      "http://portal.denali.club:3003/me/registrations"
    );
  });

  it("GSH-PS3-02 trips module id always resolves frozen alias", () => {
    assert.equal(
      resolvePortalMemberModuleUrl("denali.club", "trips"),
      "http://portal.denali.club:3003/me/registrations"
    );
  });

  it("GSH-PS3-03 profile module id resolves registry route", () => {
    assert.equal(
      resolvePortalMemberModuleUrl("denali.club", "profile"),
      "http://portal.denali.club:3003/me/profile"
    );
  });

  it("GSH-PS7-01 resolvePortalMemberModuleUrl is the sole member area builder export", () => {
    assert.equal(
      resolvePortalMemberModuleUrl("denali.club"),
      "http://portal.denali.club:3003/me/registrations"
    );
    assert.equal(
      resolvePortalMemberModuleUrl("shop.urban.localhost:3002"),
      "http://urban.portal.localhost:3003/me/registrations"
    );
  });

  it("GSH-PS3-05 unknown host falls back to frozen alias without throw", () => {
    assert.equal(
      resolvePortalMemberModuleUrl("unknown.example"),
      "http://portal.unknown.example:3003/me/registrations"
    );
  });
});
