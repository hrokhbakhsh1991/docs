import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  isPlatformAdminHost,
  parseMultiLevelTenantHost,
} from "../src/index";

const reserved = new Set(DEFAULT_TENANT_HOST_RESERVED_LABELS);

describe("parseMultiLevelTenantHost", () => {
  it("platform admin", () => {
    const outcome = parseMultiLevelTenantHost("admin.localhost", "localhost", reserved);
    assert.equal(outcome.kind, "platform_admin");
    assert.equal(isPlatformAdminHost("admin.localhost", "localhost"), true);
  });

  it("club admin", () => {
    const outcome = parseMultiLevelTenantHost("alborz.admin.localhost", "localhost", reserved);
    assert.deepEqual(outcome, { kind: "club_admin", subdomain: "alborz" });
  });

  it("club portal", () => {
    const outcome = parseMultiLevelTenantHost("alborz.portal.localhost", "localhost", reserved);
    assert.deepEqual(outcome, { kind: "club_portal", subdomain: "alborz" });
  });

  it("club apex", () => {
    const outcome = parseMultiLevelTenantHost("acme.localhost", "localhost", reserved);
    assert.deepEqual(outcome, { kind: "club_apex", subdomain: "acme" });
  });
});

describe("isPlatformAdminHost", () => {
  it("admin.root true", () => {
    assert.equal(isPlatformAdminHost("admin.example.test", "example.test"), true);
  });

  it("club.admin false", () => {
    assert.equal(isPlatformAdminHost("my-club.admin.localhost", "localhost"), false);
  });
});

describe("package root export", () => {
  it("import from package root", () => {
    assert.equal(typeof parseMultiLevelTenantHost, "function");
    assert.equal(typeof isPlatformAdminHost, "function");
  });
});
