import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform root layout bootstrap boundary", () => {
  it("does not resolve a tenant bootstrap or wrap platform routes in tenant providers", () => {
    const source = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
    const hostResolution = source.indexOf("resolveRequestIngressHost");
    const platformHostCheck = source.indexOf("isPlatformAdminHost(host)");
    const tenantBranch = source.indexOf("if (!platformAdminHost)");
    const tenantBootstrap = source.indexOf("resolveBootstrapAppSessionForHostAsync(host)");
    const appProviders = source.indexOf("<AppProviders bootstrap={bootstrap}>");

    assert.notEqual(hostResolution, -1, "root layout must use the public forwarded host");
    assert.notEqual(platformHostCheck, -1, "root layout must identify the platform host");
    assert.ok(tenantBranch < tenantBootstrap, "tenant bootstrap must be inside the non-platform branch");
    assert.notEqual(appProviders, -1, "tenant routes must keep their existing providers");
    assert.match(
      source,
      /\{bootstrap \? <AppProviders bootstrap=\{bootstrap\}>\{children\}<\/AppProviders> : children\}/,
      "platform routes must render without tenant providers"
    );
  });
});
