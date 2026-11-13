import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { parseMultiLevelTenantHost } from "@app-tour/tenant-kernel";

import { isPlatformAdminHost } from "../src/platform/is-platform-admin-host";
import {
  normalizeHostHeader,
  readPlatformRootDomainWeb,
} from "../src/tenant/platform-host-env";

function parseWebHost(host: string) {
  return parseMultiLevelTenantHost(
    normalizeHostHeader(host),
    readPlatformRootDomainWeb(),
    new Set()
  );
}

describe("platform-host-isolation", () => {
  it("4 host matrix", () => {
    assert.equal(parseWebHost("admin.localhost").kind, "platform_admin");
    assert.equal(parseWebHost("club.admin.localhost").kind, "club_admin");
    assert.equal(parseWebHost("admin.club.localhost").kind, "club_admin");
    assert.equal(parseWebHost("club.portal.localhost").kind, "club_portal");
    assert.equal(parseWebHost("club.localhost").kind, "club_apex");
  });

  it("platform≠operator", () => {
    assert.equal(isPlatformAdminHost("admin.localhost"), true);
    assert.equal(isPlatformAdminHost("club.admin.localhost"), false);
  });

  it("supports only the explicitly configured staging platform host", () => {
    const previous = process.env.PLATFORM_ADMIN_HOST;
    process.env.PLATFORM_ADMIN_HOST = "staging-platform-admin.shenski.com";
    try {
      assert.equal(isPlatformAdminHost("admin.localhost"), true);
      assert.equal(isPlatformAdminHost("staging-platform-admin.shenski.com"), true);
      assert.equal(isPlatformAdminHost("STAGING-PLATFORM-ADMIN.SHENSKI.COM:443"), true);
      assert.equal(isPlatformAdminHost("staging-admin-denali.shenski.com"), false);
      assert.equal(isPlatformAdminHost("other.shenski.com"), false);
    } finally {
      if (previous === undefined) delete process.env.PLATFORM_ADMIN_HOST;
      else process.env.PLATFORM_ADMIN_HOST = previous;
    }
  });

  it("club admin /platform blocked", () => {
    const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
    assert.match(middleware, /blockPlatformOnClubAdminHost/);
    assert.match(middleware, /club_admin/);
    assert.match(middleware, /toCanonicalClubAdminHost/);
    assert.match(middleware, /redirectLegacyClubAdminHostIfNeeded/);
  });

  it("platform host dashboard redirect", () => {
    const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
    assert.match(middleware, /blockOperatorOnWrongHost/);
    assert.match(middleware, /isProtectedAdminPath/);
  });
});
