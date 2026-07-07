/**
 * Phase D — shell-bridge decomposition contract
 * @see docs/architecture/platform-architecture-v2.md § Phase D
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

describe("shell-bridge-decomposition.spec.mjs", () => {
  it("D1-01 shell-bridge is var-map only (no operator hooks, no raw hex)", () => {
    const bridge = readSrc("shell-bridge.css");
    assert.match(bridge, /@theme inline/);
    assert.doesNotMatch(bridge, /\[data-operator-/);
    assert.doesNotMatch(bridge, /#[0-9a-fA-F]{3,8}\b/);
    assert.doesNotMatch(bridge, /@media/);
  });

  it("D1-02 operator shell structure is admin-bootstrap only", () => {
    const structure = readSrc("operator-shell-structure.css");
    assert.match(structure, /\[data-operator-shell\]/);
    assert.equal(structure.match(/#[0-9a-fA-F]{3,8}\b/g), null);
    assert.match(structure, /\[data-operator-impersonation-banner\][\s\S]*var\(--color-warning\)/);
    const adminBootstrap = readSrc("admin-bootstrap.css");
    assert.match(adminBootstrap, /operator-shell-structure\.css/);
    const portalBootstrap = readSrc("portal-bootstrap.css");
    const marketingBootstrap = readSrc("marketing-bootstrap.css");
    assert.doesNotMatch(portalBootstrap, /operator-shell-structure\.css/);
    assert.doesNotMatch(marketingBootstrap, /operator-shell-structure\.css/);
  });

  it("D1-03 package exports operator-shell-structure.css", () => {
    const pkg = readFileSync(join(packageRoot, "package.json"), "utf8");
    assert.match(pkg, /"\.\/operator-shell-structure\.css"/);
  });
});
