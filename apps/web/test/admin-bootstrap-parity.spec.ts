import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("admin-bootstrap-parity (ASB-001)", () => {
  it("web kernel delegates async bootstrap to resolveAdminBootstrapForWebHost", () => {
    const kernel = readFileSync(join(webRoot, "src/tenant/tenant-kernel.server.ts"), "utf8");
    const wrapper = readFileSync(
      join(webRoot, "src/tenant/resolve-admin-bootstrap.server.ts"),
      "utf8"
    );
    assert.match(kernel, /resolveAdminBootstrapForWebHost/);
    assert.doesNotMatch(kernel, /fetchPublicTenantContextForHost/);
    assert.match(wrapper, /resolveAdminBootstrapForHost/);
  });

  it("operator (app)/layout bootstraps via resolveRequestBootstrapAppSession (JWT overlay)", () => {
    const layout = readFileSync(join(webRoot, "app/(app)/layout.tsx"), "utf8");
    assert.match(layout, /resolveRequestBootstrapAppSession/);
    assert.doesNotMatch(layout, /resolveBootstrapAppSessionForHost\(/);
    assert.match(layout, /ensureFinanceNavSupported/);
    assert.match(layout, /ensureWizardCreate/);
  });
});
