import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPlatformAdminHost } from "../src/host/parse-multi-level-tenant-host";

describe("isPlatformAdminHost kernel helper", () => {
  it("admin.root true", () => {
    assert.equal(isPlatformAdminHost("admin.localhost", "localhost"), true);
  });

  it("club.admin false", () => {
    assert.equal(isPlatformAdminHost("club.admin.localhost", "localhost"), false);
  });
});
