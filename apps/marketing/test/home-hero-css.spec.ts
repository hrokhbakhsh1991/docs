import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readHeroCss(): string {
  return readFileSync(
    join(repoRoot, "packages/workspaces/denali/theme/marketing/home/hero.css"),
    "utf8"
  );
}

describe("home-hero-css", () => {
  it("Peak Margin scrim keeps logical gradient without literal rgb after to inline-end", () => {
    const css = readHeroCss();
    assert.match(css, /to inline-end/);
    // Next cssnano-simple crashes on `linear-gradient(to inline-end, rgb(...))`.
    // First color stop must be a var() so the minimizer skips the declaration.
    assert.doesNotMatch(css, /to inline-end,\s*rgb\(/);
    assert.match(css, /to inline-end,\s*var\(--mkt-hero-scrim-from/);
  });
});
