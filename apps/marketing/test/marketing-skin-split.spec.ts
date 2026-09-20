/**
 * MKT-3 — marketing workspace skin split contract
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { readMarketingSkinBundle } from "./read-marketing-skin-bundle";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const MAX_COMPONENT_LINES = 500;
const MAX_HOME_SLICE_LINES = 700;

function walkCss(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = join(dir, entry.name);
    return entry.isDirectory() ? walkCss(abs) : entry.name.endsWith(".css") ? [abs] : [];
  });
}

describe("marketing-skin-split.spec.ts — MKT-3", () => {
  it("MKT-SKIN-01 denali marketing entry imports partials ≤500 lines", () => {
    const entryPath = join(repoRoot, "packages/workspaces/denali/theme/denali-marketing.css");
    const entry = readFileSync(entryPath, "utf8");
    assert.match(entry, /@import\s+"\.\/marketing\/tokens\.css"/);
    assert.match(entry, /@import\s+"\.\/marketing\/shell\.css"/);

    const partialsDir = join(repoRoot, "packages/workspaces/denali/theme/marketing");
    for (const file of walkCss(partialsDir)) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      const isHomeSlice = file.includes("/marketing/home/");
      const maxLines = isHomeSlice ? MAX_HOME_SLICE_LINES : MAX_COMPONENT_LINES;
      assert.ok(lines <= maxLines, `${file} has ${lines} lines (max ${maxLines})`);
    }
  });

  it("MKT-SKIN-02 urban marketing entry imports partials ≤500 lines", () => {
    const entryPath = join(repoRoot, "packages/workspaces/urban/theme/urban-marketing.css");
    const entry = readFileSync(entryPath, "utf8");
    assert.match(entry, /@import\s+"\.\/marketing\/tokens\.css"/);

    const partialsDir = join(repoRoot, "packages/workspaces/urban/theme/marketing");
    for (const file of walkCss(partialsDir)) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      assert.ok(lines <= MAX_COMPONENT_LINES, `${file} has ${lines} lines`);
    }
  });

  it("MKT-SKIN-03 denali bundle preserves MASTER token selectors", () => {
    const entryPath = join(repoRoot, "packages/workspaces/denali/theme/denali-marketing.css");
    const bundle = readMarketingSkinBundle(entryPath);
    assert.match(bundle, /--color-primary: (?:#059669|var\(--denali-forest-600\))/);
    assert.match(bundle, /header\[data-marketing-header\]/);
    const homePath = join(
      repoRoot,
      "packages/workspaces/denali/theme/marketing/home-landing.css"
    );
    const homeBundle = readMarketingSkinBundle(homePath);
    assert.match(homeBundle, /section\[data-marketing-home-hero-walk\]/);
  });

  it("MKT-MASTER-01 production workspaces ship design-language/MASTER.md", () => {
    for (const id of ["denali", "urban", "guest-club"] as const) {
      const masterPath = join(
        repoRoot,
        "packages/workspaces",
        id,
        "design-language",
        "MASTER.md"
      );
      const master = readFileSync(masterPath, "utf8");
      assert.match(master, /# Design System Master File/);
      assert.ok(master.length > 200, `${id} MASTER.md must document brand tokens`);
    }
  });
});
