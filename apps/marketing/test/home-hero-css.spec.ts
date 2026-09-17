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
  it("Walk Hero owns landing CSS instead of Peak Margin carousel scrim", () => {
    const css = readHeroCss();
    assert.match(css, /data-marketing-home-hero-walk/);
    assert.match(css, /picture\[data-marketing-home-hero-media\]/);
    assert.doesNotMatch(css, /data-marketing-home-hero-peak-margin/);
    assert.doesNotMatch(css, /--mkt-hero-scrim-from/);
  });

  it("does not use cssnano-unsafe linear-gradient(to inline-end, rgb(...))", () => {
    const css = readHeroCss();
    // Next cssnano-simple crashes on `linear-gradient(to inline-end, rgb(...))`.
    // Walk dropped Peak Margin scrim; keep the pattern banned so it cannot return.
    assert.doesNotMatch(css, /to inline-end,\s*rgb\(/);
  });

  it("ships landing motion through the workspace bundle", () => {
    const landing = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/marketing/home-landing.css"),
      "utf8"
    );
    assert.match(landing, /@import\s+"\.\/home\/animations\.css"/);
    const motion = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/marketing/home/animations.css"),
      "utf8"
    );
    assert.match(motion, /@keyframes denali-home-fade-up/);
    assert.match(motion, /prefers-reduced-motion: reduce/);
  });
});
