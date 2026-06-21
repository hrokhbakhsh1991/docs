/**
 * P6-1 — guest app design token stack
 * @see docs/phase-19/p6-implementation-standards.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const globalsPath = join(repoRoot, "apps/marketing/app/globals.css");
const layoutPath = join(repoRoot, "apps/marketing/app/layout.tsx");

describe("guest-theme-stack.spec.ts — marketing", () => {
  it("G-P6-UI-02 imports design-tokens guest-shell + tailwind", () => {
    const css = readFileSync(globalsPath, "utf8");
    assert.match(css, /@import "@app-tour\/design-tokens\/guest-shell\.css"/);
    assert.match(css, /@import "tailwindcss"/);
    assert.doesNotMatch(css, /#0b5cab/);
    assert.match(css, /var\(--border\)/);
  });

  it("G-P6-UI-02b layout marks marketing surface", () => {
    const layout = readFileSync(layoutPath, "utf8");
    assert.match(layout, /data-app-surface="marketing"/);
  });
});
