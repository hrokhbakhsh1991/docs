/**
 * Phase D — bootstrap surface parity contract
 * @see docs/architecture/platform-architecture-v2.md § Phase D.3
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(packageRoot, "src");

function readSrc(name) {
  return readFileSync(join(srcDir, name), "utf8");
}

describe("bootstrap-surface-parity.spec.mjs", () => {
  it("D3-01 guest bootstraps share L0-L2 stack shape without operator or cross-surface fallbacks", () => {
    const portal = readSrc("portal-bootstrap.css");
    const marketing = readSrc("marketing-bootstrap.css");
    for (const bootstrap of [portal, marketing]) {
      assert.match(bootstrap, /@import "\.\/index\.css"/);
      assert.match(bootstrap, /@import "\.\/shell-bridge\.css"/);
      assert.match(bootstrap, /@import "\.\/guest-body-reset\.css"/);
      assert.match(bootstrap, /@import "\.\/platform-infra-shell\.css"/);
      assert.doesNotMatch(bootstrap, /operator-shell-structure\.css/);
      assert.doesNotMatch(bootstrap, /operator-admin-appearance\.css/);
    }
    assert.doesNotMatch(portal, /fallback-guest-marketing-shell\.css/);
    assert.doesNotMatch(marketing, /fallback-guest-portal-shell\.css/);
  });

  it("D3-02 admin-bootstrap is operator-only (no guest fallbacks)", () => {
    const admin = readSrc("admin-bootstrap.css");
    assert.match(admin, /operator-shell-structure\.css/);
    assert.match(admin, /operator-admin-appearance\.css/);
    assert.doesNotMatch(admin, /fallback-guest-portal-shell\.css/);
    assert.doesNotMatch(admin, /fallback-guest-marketing-shell\.css/);
    assert.doesNotMatch(admin, /guest-body-reset\.css/);
  });
});
