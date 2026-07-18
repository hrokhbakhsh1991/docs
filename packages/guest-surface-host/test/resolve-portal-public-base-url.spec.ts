import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolvePortalMemberLoginPath,
  resolvePortalMemberLoginUrl,
  resolvePortalMemberModuleUrl,
  resolvePortalPublicBaseUrl,
  resolvePortalRegistrationLoginPath,
  resolvePortalRegistrationLoginUrl,
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
      "http://portal.urban.localhost:3003/me/registrations"
    );
  });

  it("GSH-PS3-05 unknown host returns null when member portal cannot resolve", () => {
    assert.equal(resolvePortalMemberModuleUrl("unknown.example"), null);
  });
});

describe("resolve-portal-member-login-url — PCMS-03", () => {
  it("GSH-PCMS-01 sign-in URL targets /login with portalReturn on custom apex", () => {
    assert.equal(
      resolvePortalMemberLoginUrl("denali.club"),
      "http://portal.denali.club:3003/login?portalReturn=%2Fme%2Fregistrations"
    );
  });

  it("GSH-PCMS-02 login path preserves safe portalReturn override", () => {
    assert.equal(
      resolvePortalMemberLoginPath("denali.club", "/me/profile"),
      "/login?portalReturn=%2Fme%2Fprofile"
    );
  });

  it("GSH-PCMS-03 tour sign-in path opens register with auth=login modal", () => {
    assert.equal(
      resolvePortalRegistrationLoginPath("denali.club", "tour-abc"),
      "/catalog/tour-abc/register?auth=login"
    );
    assert.equal(
      resolvePortalRegistrationLoginUrl("denali.club", "tour-abc"),
      "http://portal.denali.club:3003/catalog/tour-abc/register?auth=login"
    );
  });
});
