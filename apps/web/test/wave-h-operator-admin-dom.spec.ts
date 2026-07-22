/**
 * Wave H.n — admin/operator shell has zero data-denali-* attribute names.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");
const DENALI_THEME = join(REPO_ROOT, "packages/workspaces/denali/theme");

const forbiddenAttrPrefix = ["data", "denali"].join("-") + "-";
const forbiddenRe = new RegExp(forbiddenAttrPrefix.replace(/-/g, "\\-"));

function listFiles(dir: string, exts: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      out.push(...listFiles(abs, exts));
      continue;
    }
    if (exts.test(entry)) out.push(abs);
  }
  return out;
}

describe("Wave H.n — operator admin DOM attrs", () => {
  it("H.n-01 apps/web src+app have zero data-denali- attrs", () => {
    for (const abs of listFiles(join(WEB_ROOT, "src"), /\.(tsx?|jsx?)$/).concat(
      listFiles(join(WEB_ROOT, "app"), /\.(tsx?|jsx?)$/)
    )) {
      const source = readFileSync(abs, "utf8");
      assert.doesNotMatch(
        source,
        forbiddenRe,
        `forbidden attr prefix in ${abs.slice(WEB_ROOT.length + 1)}`
      );
    }
  });

  it("H.n-02 denali theme CSS has zero data-denali- selectors", () => {
    for (const abs of listFiles(DENALI_THEME, /\.css$/)) {
      const css = readFileSync(abs, "utf8");
      assert.doesNotMatch(css, forbiddenRe, `forbidden in ${abs.slice(REPO_ROOT.length + 1)}`);
    }
  });

  it("H.n-03 animate + confirm dialog use data-operator-*", () => {
    const animations = readFileSync(join(DENALI_THEME, "animations.css"), "utf8");
    assert.match(animations, /\[data-operator-animate="fade-up"\]/);
    const confirm = readFileSync(
      join(WEB_ROOT, "src/admin/patterns/operator-confirm-dialog.tsx"),
      "utf8"
    );
    assert.match(confirm, /data-operator-confirm-dialog/);
    assert.match(confirm, /data-operator-surface="card"/);
  });
});
