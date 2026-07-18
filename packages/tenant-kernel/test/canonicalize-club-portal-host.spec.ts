import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  isLegacyClubPortalHost,
  toCanonicalClubPortalHost,
} from "../src/index";

const reserved = new Set(DEFAULT_TENANT_HOST_RESERVED_LABELS);

describe("toCanonicalClubPortalHost — PCMS-COOK-05", () => {
  it("rewrites denali.portal.localhost:3003 → portal.denali.localhost:3003", () => {
    assert.equal(
      toCanonicalClubPortalHost("denali.portal.localhost:3003", "localhost", reserved),
      "portal.denali.localhost:3003"
    );
    assert.equal(isLegacyClubPortalHost("denali.portal.localhost:3003", "localhost", reserved), true);
  });

  it("rewrites legacy without port", () => {
    assert.equal(
      toCanonicalClubPortalHost("operator.portal.localhost", "localhost", reserved),
      "portal.operator.localhost"
    );
  });

  it("does not rewrite canonical portal.denali.localhost:3003", () => {
    assert.equal(
      toCanonicalClubPortalHost("portal.denali.localhost:3003", "localhost", reserved),
      null
    );
    assert.equal(isLegacyClubPortalHost("portal.denali.localhost:3003", "localhost", reserved), false);
  });

  it("fails closed on invalid / empty hosts", () => {
    assert.equal(toCanonicalClubPortalHost("", "localhost", reserved), null);
    assert.equal(toCanonicalClubPortalHost("   ", "localhost", reserved), null);
    assert.equal(toCanonicalClubPortalHost("not-a-portal-host.localhost", "localhost", reserved), null);
    assert.equal(toCanonicalClubPortalHost("denali.localhost:3002", "localhost", reserved), null);
  });

  it("does not transform custom apex portal hosts", () => {
    assert.equal(toCanonicalClubPortalHost("portal.denali.club:3003", "localhost", reserved), null);
    assert.equal(toCanonicalClubPortalHost("portal.denali.club", "localhost", reserved), null);
    assert.equal(toCanonicalClubPortalHost("denali.club", "localhost", reserved), null);
  });

  it("does not rewrite when rootDomain is not localhost", () => {
    assert.equal(
      toCanonicalClubPortalHost("denali.portal.example.com:3003", "example.com", reserved),
      null
    );
    assert.equal(
      toCanonicalClubPortalHost("denali.portal.localhost:3003", "example.com", reserved),
      null
    );
  });

  it("fails closed on reserved club labels", () => {
    assert.equal(toCanonicalClubPortalHost("admin.portal.localhost:3003", "localhost", reserved), null);
    assert.equal(toCanonicalClubPortalHost("www.portal.localhost", "localhost", reserved), null);
  });
});
