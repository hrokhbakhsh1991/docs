/**
 * Wave H.l — shell uses product-blind operator surface DOM attr.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DENALI_THEME = join(
  WEB_ROOT,
  "../../packages/workspaces/denali/theme"
);

function listSourceFiles(dir: string): string[] {
  /** @type {string[]} */
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      out.push(...listSourceFiles(abs));
      continue;
    }
    if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry)) out.push(abs);
  }
  return out;
}

describe("Wave H.l — operator surface attr", () => {
  // Avoid embedding the forbidden attr string in this file (self-scan / grep hygiene).
  const forbiddenSurfaceAttr = ["data", "denali", "surface"].join("-");
  const forbiddenRe = new RegExp(forbiddenSurfaceAttr);

  it("H.l-01 apps/web src+app has zero legacy denali surface attr", () => {
    for (const abs of listSourceFiles(join(WEB_ROOT, "src")).concat(
      listSourceFiles(join(WEB_ROOT, "app"))
    )) {
      const source = readFileSync(abs, "utf8");
      assert.doesNotMatch(
        source,
        forbiddenRe,
        `forbidden attr in ${abs.slice(WEB_ROOT.length + 1)}`
      );
    }
  });

  it("H.l-02 denali theme skins target data-operator-surface", () => {
    const interactions = readFileSync(join(DENALI_THEME, "interactions.css"), "utf8");
    const adminSkin = readFileSync(join(DENALI_THEME, "admin-skin.css"), "utf8");
    assert.match(interactions, /\[data-operator-surface="card"\]/);
    assert.doesNotMatch(interactions, forbiddenRe);
    assert.match(adminSkin, /\[data-operator-surface="card"\]/);
    assert.doesNotMatch(adminSkin, forbiddenRe);
  });

  it("H.l-03 operator confirm dialog uses data-operator-surface", () => {
    const source = readFileSync(
      join(WEB_ROOT, "src/admin/patterns/operator-confirm-dialog.tsx"),
      "utf8"
    );
    assert.match(source, /data-operator-surface="card"/);
  });
});
