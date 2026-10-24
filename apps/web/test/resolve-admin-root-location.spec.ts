import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { resolveAdminRootLocation } from "../src/admin/resolve-admin-root-location";

describe("resolve-admin-root-location", () => {
  it("uses the public admin host behind an internal proxy origin", () => {
    assert.equal(
      resolveAdminRootLocation({
        pathname: "/dashboard",
        host: "admin.denali.shenski.com",
        forwardedProtocol: "https",
        requestProtocol: "https:",
      }),
      "https://admin.denali.shenski.com/dashboard"
    );
  });

  it("falls back to request protocol when forwarded protocol is untrusted", () => {
    assert.equal(
      resolveAdminRootLocation({
        pathname: "/dashboard",
        host: "admin.denali.localhost:3000",
        forwardedProtocol: "javascript",
        requestProtocol: "http:",
      }),
      "http://admin.denali.localhost:3000/dashboard"
    );
  });

  it("middleware builds the admin root redirect from the resolved public host", () => {
    const source = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
    assert.match(source, /resolveAdminRootLocation\(/);
    assert.match(source, /host,\s*forwardedProtocol:\s*request\.headers\.get\("x-forwarded-proto"\)/);
  });
});
