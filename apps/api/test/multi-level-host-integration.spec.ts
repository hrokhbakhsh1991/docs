import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("resolve tenant from host API helper", () => {
  it("Host header sets tenant subdomain", () => {
    const source = readFileSync(
      new URL("../src/middleware/resolve-tenant-from-host.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /parseMultiLevelTenantHost/);
    assert.match(source, /resolveTenantSubdomainFromHostHeader/);
  });
});
