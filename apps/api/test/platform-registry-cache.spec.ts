import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform registry cache after provision", () => {
  it("resolveBySubdomain finds tenant", () => {
    const cacheSource = readFileSync(
      new URL("../src/tenant/tenant-registry-cache.ts", import.meta.url),
      "utf8"
    );
    const sagaSource = readFileSync(
      new URL("../src/platform/provision-tenant-saga.ts", import.meta.url),
      "utf8"
    );

    assert.match(cacheSource, /getCachedTenantBySubdomain/);
    assert.match(sagaSource, /invalidateTenantRegistryCache\(result\.tenant\.id, result\.tenant\.subdomain\)/);
    const lifecycleSource = readFileSync(
      new URL("../src/platform/platform-tenant-lifecycle.service.ts", import.meta.url),
      "utf8"
    );
    assert.match(lifecycleSource, /invalidateTenantRegistryCache/);
    assert.match(lifecycleSource, /updatePlatformTenantStatus/);
  });
});
