import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("branding-server-prefetch.spec.ts", () => {
  it("BRANDING-01 branding page prefetches on the server", () => {
    const pageSource = readFileSync(
      resolve(WEB_ROOT, "app/(app)/settings/branding/page.tsx"),
      "utf8"
    );
    assert.match(pageSource, /fetchTenantBrandingServer/);
    assert.match(pageSource, /initialBranding/);
  });

  it("BRANDING-02 branding client skips first fetch when initialBranding is provided", () => {
    const clientSource = readFileSync(
      resolve(WEB_ROOT, "app/(app)/settings/branding/branding-settings-client.tsx"),
      "utf8"
    );
    assert.match(clientSource, /initialBranding/);
    assert.match(clientSource, /skipInitialFetchRef/);
  });
});
