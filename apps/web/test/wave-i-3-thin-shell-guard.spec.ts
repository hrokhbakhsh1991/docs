/**
 * Wave I.3 — guard:thin-shell allowlist contract.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Wave I.3 — thin-shell guard", () => {
  it("I.3-01 guard script encodes generated allowlist (theme CSS ambient is generated)", () => {
    const source = readFileSync(join(REPO, "scripts/guards/guard-thin-shell.mjs"), "utf8");
    assert.match(source, /\.generated\./);
    assert.match(source, /workspace-sdk/);
    // Forbidden path must remain encoded as a ban string (do not strip).
    assert.match(source, /wizard\/denali/);
    assert.doesNotMatch(source, /workspace-theme-css\.d\.ts/);
  });

  it("I.3-02 wave-i0 matrix includes guard:thin-shell", () => {
    const sh = readFileSync(join(REPO, "scripts/wave-i0-guard.sh"), "utf8");
    assert.match(sh, /guard:thin-shell/);
    const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    assert.match(pkg.scripts?.["guard:thin-shell"] ?? "", /guard-thin-shell\.mjs/);
  });
});
