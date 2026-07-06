/**
 * PTL-VIS — portal shell visual regression CI scaffold
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const portalRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("portal-shell-visual.spec.ts — PTL-VIS CI scaffold", () => {
  it("PTL-VIS-01 playwright visual configs and specs exist", () => {
    assert.ok(existsSync(join(portalRoot, "playwright.portal-visual.config.ts")));
    assert.ok(existsSync(join(portalRoot, "tests/e2e/portal-shell-visual.spec.ts")));
    assert.ok(existsSync(join(portalRoot, "tests/e2e/portal-shell-visual-urban.spec.ts")));
    assert.ok(existsSync(join(portalRoot, "tests/e2e/portal-shell-visual-guest-club.spec.ts")));
    const spec = readFileSync(
      join(portalRoot, "tests/e2e/portal-shell-visual.spec.ts"),
      "utf8"
    );
    assert.match(spec, /SMK-PTL-VIS-01/);
    assert.match(spec, /toHaveScreenshot/);
  });

  it("PTL-VIS-02 package exposes visual matrix scripts", () => {
    const pkg = readFileSync(join(portalRoot, "package.json"), "utf8");
    assert.match(pkg, /test:smoke:visual:matrix/);
    assert.match(pkg, /test:smoke:visual:urban/);
    assert.match(pkg, /test:smoke:visual:guest-club/);
  });
});
