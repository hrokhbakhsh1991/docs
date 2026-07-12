import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("identity-bff-asb (ASB-001)", () => {
  it("operator BFF headers delegate admin bootstrap without legacy tenant-context fetch", () => {
    const source = readFileSync(join(webRoot, "src/auth/identity-bff-headers.ts"), "utf8");
    assert.match(source, /resolveAdminBootstrapForWebHost/);
    assert.doesNotMatch(source, /fetchPublicTenantContextForHost/);
    assert.doesNotMatch(source, /resolvePublicFallbackTenantId/);
  });
});
