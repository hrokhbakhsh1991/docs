import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform-middleware-imports", () => {
  it("no duplicate TENANT_SUBDOMAIN_REGEX in middleware", () => {
    const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
    assert.doesNotMatch(middleware, /TENANT_SUBDOMAIN_REGEX/);
    assert.match(middleware, /parseMultiLevelTenantHost/);
  });

  it("is-platform-admin-host imports kernel", () => {
    const source = readFileSync(
      new URL("../src/platform/is-platform-admin-host.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /@app-tour\/tenant-kernel/);
    assert.doesNotMatch(source, /TENANT_SUBDOMAIN_REGEX/);
  });
});
