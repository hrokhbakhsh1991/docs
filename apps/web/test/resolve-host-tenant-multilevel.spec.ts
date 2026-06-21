import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { resolveTenantIdFromDevHost } from "../src/tenant/resolve-host-tenant";

describe("resolve-host-tenant multilevel", () => {
  it("document or resolve alborz admin host", () => {
    const source = readFileSync(
      new URL("../src/tenant/resolve-host-tenant.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /resolveMultiLevelHost/);
    assert.match(source, /club_admin/);
  });

  it("resolves alborz admin localhost in dev", () => {
    const oldNode = process.env.NODE_ENV;
    const oldAllow = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    try {
      assert.equal(
        resolveTenantIdFromDevHost("alborz.admin.localhost:3000"),
        "00000000-0000-4000-8000-000000000003"
      );
    } finally {
      process.env.NODE_ENV = oldNode;
      process.env.ALLOW_DEV_WEB_SESSION = oldAllow;
    }
  });
});
