/**
 * MKT-7 — marketing shell visual regression CI scaffold
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("marketing-shell-visual.spec.ts — MKT-7 CI scaffold", () => {
  it("MKT-VIS-01 playwright visual config and spec exist", () => {
    assert.ok(existsSync(join(marketingRoot, "playwright.marketing-visual.config.ts")));
    assert.ok(existsSync(join(marketingRoot, "tests/e2e/marketing-shell-visual.spec.ts")));
    const spec = readFileSync(
      join(marketingRoot, "tests/e2e/marketing-shell-visual.spec.ts"),
      "utf8"
    );
    assert.match(spec, /SMK-MKT-VIS-01/);
    assert.match(spec, /SMK-MKT-VIS-02/);
    assert.match(spec, /toHaveScreenshot/);
  });

  it("MKT-VIS-02 package exposes test:smoke:visual scripts and baselines", () => {
    const pkg = readFileSync(join(marketingRoot, "package.json"), "utf8");
    assert.match(pkg, /test:smoke:visual/);
    assert.match(pkg, /test:smoke:visual:update/);
    assert.match(pkg, /test:smoke:visual:urban/);
    assert.match(pkg, /test:smoke:visual:guest-club/);
    assert.match(pkg, /test:smoke:visual:matrix/);
    const snapDir = join(
      marketingRoot,
      "tests/e2e/marketing-shell-visual.spec.ts-snapshots"
    );
    assert.ok(existsSync(snapDir), "snapshot directory must exist");
    assert.ok(existsSync(join(snapDir, "denali-home-shell-header.png")));
    assert.ok(existsSync(join(snapDir, "denali-catalog-shell-chrome.png")));
    assert.ok(
      existsSync(join(marketingRoot, "tests/e2e/marketing-shell-visual-urban.spec.ts"))
    );
    assert.ok(
      existsSync(join(marketingRoot, "tests/e2e/marketing-shell-visual-guest-club.spec.ts"))
    );
    const urbanSnapDir = join(
      marketingRoot,
      "tests/e2e/marketing-shell-visual-urban.spec.ts-snapshots"
    );
    const guestSnapDir = join(
      marketingRoot,
      "tests/e2e/marketing-shell-visual-guest-club.spec.ts-snapshots"
    );
    assert.ok(existsSync(urbanSnapDir), "urban snapshot directory must exist");
    assert.ok(existsSync(guestSnapDir), "guest-club snapshot directory must exist");
    assert.ok(existsSync(join(urbanSnapDir, "urban-home-shell-header.png")));
    assert.ok(existsSync(join(guestSnapDir, "guest-club-home-shell-header.png")));
  });
});
