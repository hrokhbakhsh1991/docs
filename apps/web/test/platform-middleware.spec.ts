import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { isPlatformAdminHost } from "../src/platform/is-platform-admin-host";

describe("platform middleware host branch", () => {
  it("detect admin host", () => {
    assert.equal(isPlatformAdminHost("admin.localhost:3000"), true);
    assert.equal(isPlatformAdminHost("my-club.admin.localhost:3000"), false);
  });

  it("platform branch", () => {
    const source = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
    assert.match(source, /handlePlatformAdminHost/);
    assert.match(source, /isPlatformAdminHost/);
  });
});
