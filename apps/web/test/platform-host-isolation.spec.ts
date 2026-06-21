import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { isPlatformAdminHost } from "../src/platform/is-platform-admin-host";
import { resolveMultiLevelHost } from "../src/tenant/resolve-multi-level-host";

describe("platform-host-isolation", () => {
  it("4 host matrix", () => {
    assert.equal(resolveMultiLevelHost("admin.localhost").kind, "platform_admin");
    assert.equal(resolveMultiLevelHost("club.admin.localhost").kind, "club_admin");
    assert.equal(resolveMultiLevelHost("club.portal.localhost").kind, "club_portal");
    assert.equal(resolveMultiLevelHost("club.localhost").kind, "club_apex");
  });

  it("platform≠operator", () => {
    assert.equal(isPlatformAdminHost("admin.localhost"), true);
    assert.equal(isPlatformAdminHost("club.admin.localhost"), false);
  });

  it("club admin /platform blocked", () => {
    const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
    assert.match(middleware, /blockPlatformOnClubAdminHost/);
    assert.match(middleware, /club_admin/);
  });

  it("platform host dashboard redirect", () => {
    const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
    assert.match(middleware, /blockOperatorOnWrongHost/);
    assert.match(middleware, /isProtectedAdminPath/);
  });
});
